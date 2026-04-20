// Stub route modules — Phase 2 implementation
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middleware/auth-guard.js'

export const moduleRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)

  app.get('/', async (req) => {
    const { courseId } = req.params as { courseId: string }
    return app.prisma.module.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      include: { lessons: { orderBy: { position: 'asc' } } },
    })
  })

  app.post('/', async (req, reply) => {
    const { courseId } = req.params as { courseId: string }
    const body = req.body as any
    const mod = await app.prisma.module.create({
      data: { courseId, title: body.title, description: body.description, position: body.position ?? 1 },
    })
    return reply.status(201).send(mod)
  })
}
