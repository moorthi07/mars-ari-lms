// ── Lesson routes ─────────────────────────────────────────────────────────────
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middleware/auth-guard.js'

export const lessonRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)
  app.get('/', async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    return app.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
    })
  })
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const lesson = await app.prisma.lesson.findUnique({
      where: { id },
      include: { quiz: { include: { questions: true } }, media: true },
    })
    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' })
    return lesson
  })
  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string }
    return app.prisma.lesson.update({ where: { id }, data: req.body as any })
  })
}
