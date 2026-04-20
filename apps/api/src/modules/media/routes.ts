import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth-guard.js'

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)
  // Phase 2: MinIO presigned upload URLs, CDN delivery
  app.get('/upload-url', async (_req, reply) =>
    reply.send({ message: 'Media upload — Phase 2 implementation' })
  )
}

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)
  // Phase 2: Stripe checkout session creation
  app.post('/checkout', async (_req, reply) =>
    reply.send({ message: 'Stripe checkout — Phase 2 implementation' })
  )
  app.get('/invoices', async (req) => {
    const user = (req as any).user
    return app.prisma.invoice.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    })
  })
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // Stripe webhook (raw body)
  app.post('/stripe', { config: { rawBody: true } }, async (_req, reply) =>
    reply.send({ received: true })
  )
}

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)

  app.get('/me', async (req) => {
    const user = (req as any).user
    return app.prisma.tenant.findUnique({ where: { id: user.tenantId } })
  })

  app.patch('/me', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req) => {
    const user = (req as any).user
    return app.prisma.tenant.update({ where: { id: user.tenantId }, data: req.body as any })
  })

  app.get('/me/ai-config', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req) => {
    const user = (req as any).user
    return app.prisma.tenantAIConfig.findMany({ where: { tenantId: user.tenantId } })
  })

  app.put('/me/ai-config', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const user = (req as any).user
    const body = req.body as any
    const config = await app.prisma.tenantAIConfig.upsert({
      where:  { tenantId_provider: { tenantId: user.tenantId, provider: body.provider } },
      create: { tenantId: user.tenantId, ...body },
      update: body,
    })
    return reply.status(200).send(config)
  })
}

export const notificationRoutes: FastifyPluginAsync = async (_app) => {
  // Phase 2: email, in-app notifications
}
