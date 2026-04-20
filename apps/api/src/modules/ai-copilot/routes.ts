/**
 * AI Copilot routes
 * POST /ai-copilot/generate-curriculum  → SSE stream
 * POST /ai-copilot/generate-lesson      → SSE stream
 * POST /ai-copilot/enrich-media         → JSON
 * POST /ai-copilot/generate-quiz        → JSON
 * GET  /ai-copilot/jobs/:jobId          → job status
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth-guard.js'
import { runCurriculumAgent, streamCurriculumAgent } from './agents/curriculum-agent.js'
import { runContentAgent, streamContentAgent } from './agents/content-agent.js'
import { enrichMedia } from './agents/media-agent.js'
import { runQuizAgent } from './agents/quiz-agent.js'

const generateCurriculumBody = z.object({
  title:        z.string().min(3).max(200),
  description:  z.string().min(10).max(2000),
  audience:     z.string().optional(),
  requirements: z.string().optional(),
  stream:       z.boolean().default(true),
})

const generateLessonBody = z.object({
  courseTitle:      z.string(),
  moduleTitle:      z.string(),
  lessonTitle:      z.string(),
  contentType:      z.string(),
  objectives:       z.array(z.string()),
  estimatedMinutes: z.number(),
  level:            z.string().optional(),
  stream:           z.boolean().default(true),
})

const enrichMediaBody = z.object({
  videoSearchBlocks: z.array(z.object({
    query:      z.string(),
    rationale:  z.string(),
    blockIndex: z.number(),
  })),
  imagePromptBlocks: z.array(z.object({
    prompt:     z.string(),
    alt:        z.string(),
    blockIndex: z.number(),
  })),
})

const generateQuizBody = z.object({
  courseTitle:  z.string(),
  lessonTitle:  z.string(),
  objectives:   z.array(z.string()),
  questionCount: z.number().int().min(3).max(30).default(10),
})

export const aiCopilotRoutes: FastifyPluginAsync = async (app) => {
  // All copilot routes require instructor or admin
  app.addHook('onRequest', requireAuth)
  app.addHook('onRequest', requireRole(['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN']))

  /**
   * POST /ai-copilot/generate-curriculum
   * SSE stream of curriculum JSON chunks as they arrive from the LLM.
   * Frontend accumulates chunks, parses when stream ends.
   */
  app.post('/generate-curriculum', async (req, reply) => {
    const body = generateCurriculumBody.parse(req.body)
    const tenantConfig = await getTenantAIConfig(req, app)

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      try {
        const gen = streamCurriculumAgent({
          ...body,
          tenantConfig,
        })
        for await (const chunk of gen) {
          reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`)
        }
        reply.raw.write('data: [DONE]\n\n')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed'
        reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
      } finally {
        reply.raw.end()
      }
      return reply
    }

    // Non-streaming fallback
    const curriculum = await runCurriculumAgent({ ...body, tenantConfig })
    return reply.send(curriculum)
  })

  /**
   * POST /ai-copilot/generate-lesson
   * SSE stream of lesson content blocks.
   */
  app.post('/generate-lesson', async (req, reply) => {
    const body = generateLessonBody.parse(req.body)
    const tenantConfig = await getTenantAIConfig(req, app)

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      try {
        const gen = streamContentAgent({ ...body, tenantConfig })
        for await (const chunk of gen) {
          reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`)
        }
        reply.raw.write('data: [DONE]\n\n')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed'
        reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
      } finally {
        reply.raw.end()
      }
      return reply
    }

    const content = await runContentAgent({ ...body, tenantConfig })
    return reply.send(content)
  })

  /**
   * POST /ai-copilot/enrich-media
   * Takes video_search and image_prompt blocks, resolves them.
   */
  app.post('/enrich-media', async (req, reply) => {
    const body = enrichMediaBody.parse(req.body)
    const result = await enrichMedia(body)
    return reply.send(result)
  })

  /**
   * POST /ai-copilot/generate-quiz
   */
  app.post('/generate-quiz', async (req, reply) => {
    const body = generateQuizBody.parse(req.body)
    const tenantConfig = await getTenantAIConfig(req, app)
    const quiz = await runQuizAgent({ ...body, tenantConfig })
    return reply.send(quiz)
  })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getTenantAIConfig(req: any, app: any) {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) return null
    return await app.prisma.tenantAIConfig.findFirst({
      where: { tenantId, isDefault: true },
    })
  } catch {
    return null
  }
}
