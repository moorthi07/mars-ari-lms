/**
 * Background worker — processes async AI Copilot jobs via BullMQ.
 * Runs as a separate container (mars-ari-worker).
 *
 * Queues:
 *   ai-copilot  — curriculum/lesson/quiz generation
 *   media       — YouTube search + image generation
 *   webhooks    — outbound webhook delivery with retry
 *   emails      — transactional emails (enrollment, cert)
 */
import { Worker, Queue, QueueEvents } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { config } from './config/index.js'
import { runCurriculumAgent } from './modules/ai-copilot/agents/curriculum-agent.js'
import { runContentAgent } from './modules/ai-copilot/agents/content-agent.js'
import { enrichMedia } from './modules/ai-copilot/agents/media-agent.js'
import { runQuizAgent } from './modules/ai-copilot/agents/quiz-agent.js'

const redis  = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
const prisma = new PrismaClient()

const connection = { connection: redis }

// ── AI Copilot worker ─────────────────────────────────────────────────────────

const aiWorker = new Worker(
  'ai-copilot',
  async (job) => {
    const { jobId, type, input } = job.data as {
      jobId: string
      type:  'curriculum' | 'lesson' | 'quiz' | 'media'
      input: Record<string, unknown>
    }

    await prisma.aICopilotJob.update({
      where: { id: jobId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    })

    try {
      let result: unknown

      switch (type) {
        case 'curriculum':
          result = await runCurriculumAgent(input as any)
          break
        case 'lesson':
          result = await runContentAgent(input as any)
          break
        case 'quiz':
          result = await runQuizAgent(input as any)
          break
        case 'media':
          result = await enrichMedia(input as any)
          break
        default:
          throw new Error(`Unknown AI job type: ${String(type)}`)
      }

      await prisma.aICopilotJob.update({
        where: { id: jobId },
        data:  {
          status:      'COMPLETED',
          result:      result as any,
          completedAt: new Date(),
        },
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.aICopilotJob.update({
        where: { id: jobId },
        data:  { status: 'FAILED', error: message, completedAt: new Date() },
      })
      throw err
    }
  },
  {
    ...connection,
    concurrency: 3, // max 3 AI jobs in parallel
  }
)

// ── Webhook delivery worker ───────────────────────────────────────────────────

import axios from 'axios'
import crypto from 'node:crypto'

const webhookWorker = new Worker(
  'webhooks',
  async (job) => {
    const { integrationId, event, payload, secret } = job.data as {
      integrationId: string
      event:         string
      payload:       Record<string, unknown>
      secret:        string
      url:           string
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    })
    if (!integration?.webhookUrl) return

    const body      = JSON.stringify(payload)
    const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
    const start     = Date.now()

    const resp = await axios.post(integration.webhookUrl, payload, {
      headers: {
        'Content-Type':     'application/json',
        'X-Marsari-Signature': signature,
        'X-Marsari-Event':     event,
      },
      timeout: 15_000,
    })

    await prisma.webhookLog.create({
      data: {
        integrationId,
        event:          event as any,
        payload,
        responseStatus: resp.status,
        responseBody:   String(resp.data).slice(0, 500),
        durationMs:     Date.now() - start,
      },
    })
  },
  {
    ...connection,
    concurrency: 10,
    limiter: { max: 100, duration: 1000 }, // 100 webhooks/sec max
  }
)

// ── Logging ───────────────────────────────────────────────────────────────────

for (const worker of [aiWorker, webhookWorker]) {
  worker.on('completed', (job) => console.log(`✅ [${job.queueName}] job ${job.id} completed`))
  worker.on('failed',    (job, err) => console.error(`❌ [${job?.queueName}] job ${job?.id} failed:`, err.message))
  worker.on('error',     (err) => console.error('Worker error:', err))
}

// ── Queue exports (for use in API) ────────────────────────────────────────────

export const aiQueue      = new Queue('ai-copilot', connection)
export const webhookQueue = new Queue('webhooks',   connection)

console.log('🔄 Mars-ari LMS worker started')
console.log('   Queues: ai-copilot, webhooks')

// Graceful shutdown
process.on('SIGTERM', async () => {
  await aiWorker.close()
  await webhookWorker.close()
  await prisma.$disconnect()
  redis.quit()
  process.exit(0)
})
