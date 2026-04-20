/**
 * Integration module
 * Supports three integration types:
 *   LINK    — external URL opened in new tab or embedded iframe
 *   SDK     — npm package + config injected into lesson runtime
 *   WEBHOOK — outbound POST to external platform on LMS events
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import axios from 'axios'
import { requireAuth, requireRole } from '../../middleware/auth-guard.js'

const createIntegrationBody = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().optional(),
  type:        z.enum(['LINK', 'SDK', 'WEBHOOK']),

  // LINK fields
  linkUrl:    z.string().url().optional(),
  linkTarget: z.enum(['_blank', 'iframe']).optional().default('_blank'),

  // SDK fields
  sdkPackage: z.string().optional(),
  sdkConfig:  z.record(z.unknown()).optional(),

  // WEBHOOK fields
  webhookUrl:    z.string().url().optional(),
  webhookEvents: z.array(z.enum([
    'COURSE_ENROLLED', 'LESSON_COMPLETED', 'COURSE_COMPLETED',
    'QUIZ_PASSED', 'QUIZ_FAILED', 'CERTIFICATE_ISSUED',
    'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED',
  ])).optional(),
})

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)

  /** List all integrations for the tenant */
  app.get('/', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req) => {
    const tenantId = (req as any).user.tenantId
    return app.prisma.integration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  })

  /** Create integration */
  app.post('/', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const tenantId = (req as any).user.tenantId
    const body = createIntegrationBody.parse(req.body)

    // Validate required fields per type
    if (body.type === 'LINK' && !body.linkUrl) {
      return reply.status(400).send({ error: 'linkUrl is required for LINK integrations' })
    }
    if (body.type === 'SDK' && !body.sdkPackage) {
      return reply.status(400).send({ error: 'sdkPackage is required for SDK integrations' })
    }
    if (body.type === 'WEBHOOK' && !body.webhookUrl) {
      return reply.status(400).send({ error: 'webhookUrl is required for WEBHOOK integrations' })
    }

    const integration = await app.prisma.integration.create({
      data: {
        tenantId,
        name:          body.name,
        description:   body.description,
        type:          body.type,
        linkUrl:       body.linkUrl,
        linkTarget:    body.linkTarget,
        sdkPackage:    body.sdkPackage,
        sdkConfig:     body.sdkConfig,
        webhookUrl:    body.webhookUrl,
        webhookSecret: body.type === 'WEBHOOK'
          ? crypto.randomBytes(32).toString('hex')
          : undefined,
        webhookEvents: body.webhookEvents ?? [],
      },
    })

    return reply.status(201).send(integration)
  })

  /** Test webhook integration */
  app.post('/:id/test', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req as any).user.tenantId

    const integration = await app.prisma.integration.findFirst({
      where: { id, tenantId, type: 'WEBHOOK' },
    })
    if (!integration) {
      return reply.status(404).send({ error: 'Webhook integration not found' })
    }

    const payload = {
      event:     'TEST',
      tenantId,
      timestamp: new Date().toISOString(),
      test:      true,
    }

    const signature = signPayload(payload, integration.webhookSecret ?? '')

    try {
      const resp = await axios.post(integration.webhookUrl!, payload, {
        headers: {
          'Content-Type':      'application/json',
          'X-Marsari-Signature':  signature,
          'X-Marsari-Event':      'TEST',
          'X-Marsari-Tenant':     tenantId,
        },
        timeout: 10_000,
      })
      return reply.send({ success: true, status: resp.status })
    } catch (err: any) {
      return reply.send({
        success: false,
        error:   err?.message ?? 'Request failed',
        status:  err?.response?.status,
      })
    }
  })

  /** Delete integration */
  app.delete('/:id', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req as any).user.tenantId
    await app.prisma.integration.deleteMany({ where: { id, tenantId } })
    return reply.status(204).send()
  })
}

// ─── Webhook dispatcher (called internally on LMS events) ────────────────────

export async function dispatchWebhookEvent(
  prisma: any,
  tenantId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: {
      tenantId,
      type:     'WEBHOOK',
      isActive: true,
      webhookEvents: { has: event },
    },
  })

  await Promise.allSettled(
    integrations.map(async (integration: any) => {
      const fullPayload = {
        event,
        tenantId,
        timestamp: new Date().toISOString(),
        data: payload,
      }
      const signature = signPayload(fullPayload, integration.webhookSecret ?? '')
      const start = Date.now()

      try {
        const resp = await axios.post(integration.webhookUrl, fullPayload, {
          headers: {
            'Content-Type':     'application/json',
            'X-Marsari-Signature': signature,
            'X-Marsari-Event':     event,
            'X-Marsari-Tenant':    tenantId,
          },
          timeout: 15_000,
        })

        await prisma.webhookLog.create({
          data: {
            integrationId:  integration.id,
            event,
            payload:        fullPayload,
            responseStatus: resp.status,
            responseBody:   String(resp.data).slice(0, 500),
            durationMs:     Date.now() - start,
          },
        })
      } catch (err: any) {
        await prisma.webhookLog.create({
          data: {
            integrationId:  integration.id,
            event,
            payload:        fullPayload,
            responseStatus: err?.response?.status ?? 0,
            responseBody:   err?.message ?? 'failed',
            durationMs:     Date.now() - start,
          },
        })
      }
    })
  )
}

function signPayload(payload: unknown, secret: string): string {
  const body = JSON.stringify(payload)
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
}
