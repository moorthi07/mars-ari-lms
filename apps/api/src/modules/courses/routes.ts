import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth-guard.js'
import { dispatchWebhookEvent } from '../integrations/routes.js'

const createCourseBody = z.object({
  title:          z.string().min(3).max(200),
  description:    z.string().optional(),
  level:          z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedHours: z.number().optional(),
  price:          z.number().min(0).optional(),
  currency:       z.string().length(3).optional(),
  isFree:         z.boolean().optional(),
  tags:           z.array(z.string()).optional(),
  objectives:     z.array(z.string()).optional(),
  prerequisites:  z.array(z.string()).optional(),
  // AI copilot can pass modules to auto-create
  modules: z.array(z.object({
    title:       z.string(),
    description: z.string().optional(),
    lessons: z.array(z.object({
      title:            z.string(),
      contentType:      z.string(),
      description:      z.string().optional(),
      estimatedMinutes: z.number().optional(),
    })).optional(),
  })).optional(),
})

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80)
}

export const courseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)

  /** GET /courses — list with filters */
  app.get('/', async (req) => {
    const user  = (req as any).user
    const query = req.query as Record<string, string>

    const where: any = { tenantId: user.tenantId }
    if (query['status']) where.status = query['status']
    if (query['level'])  where.level  = query['level']
    if (query['search']) {
      where.OR = [
        { title:       { contains: query['search'], mode: 'insensitive' } },
        { description: { contains: query['search'], mode: 'insensitive' } },
      ]
    }
    // Students only see published
    if (user.role === 'STUDENT' || user.role === 'GUEST') {
      where.status = 'PUBLISHED'
    }

    const [data, total] = await Promise.all([
      app.prisma.course.findMany({
        where,
        include: {
          authors: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          _count:  { select: { modules: true, enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take:    Number(query['limit'] ?? 20),
        skip:    Number(query['offset'] ?? 0),
      }),
      app.prisma.course.count({ where }),
    ])

    return { data, total, limit: Number(query['limit'] ?? 20), offset: Number(query['offset'] ?? 0) }
  })

  /** GET /courses/:id */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user   = (req as any).user

    const course = await app.prisma.course.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        authors:  { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        modules:  { orderBy: { position: 'asc' }, include: {
          lessons: { orderBy: { position: 'asc' }, select: {
            id: true, title: true, contentType: true, position: true,
            isPublished: true, isFree: true, estimatedMinutes: true,
          }},
        }},
        _count: { select: { enrollments: true } },
      },
    })

    if (!course) return reply.status(404).send({ error: 'Course not found' })
    return course
  })

  /** POST /courses — create (instructor+) */
  app.post('/', { onRequest: [requireRole(['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const user = (req as any).user
    const body = createCourseBody.parse(req.body)
    const slug = slugify(body.title)

    const course = await app.prisma.course.create({
      data: {
        tenantId:       user.tenantId,
        slug,
        title:          body.title,
        description:    body.description,
        level:          body.level,
        estimatedHours: body.estimatedHours,
        price:          body.price,
        currency:       body.currency ?? 'usd',
        isFree:         body.isFree ?? !body.price,
        tags:           body.tags ?? [],
        objectives:     body.objectives ?? [],
        prerequisites:  body.prerequisites ?? [],
        authors:        { create: { userId: user.id, role: 'author' } },
        // Create module/lesson tree if provided (from AI copilot)
        modules: body.modules ? {
          create: body.modules.map((mod, mi) => ({
            title:       mod.title,
            description: mod.description,
            position:    mi + 1,
            lessons: mod.lessons ? {
              create: mod.lessons.map((les, li) => ({
                title:            les.title,
                contentType:      les.contentType as any,
                position:         li + 1,
                estimatedMinutes: les.estimatedMinutes,
              })),
            } : undefined,
          })),
        } : undefined,
      },
    })

    await app.audit(req, { action: 'course.create', resource: 'Course', resourceId: course.id, after: course })
    return reply.status(201).send(course)
  })

  /** PATCH /courses/:id */
  app.patch('/:id', { onRequest: [requireRole(['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user   = (req as any).user
    const body   = req.body as Record<string, unknown>

    const before = await app.prisma.course.findFirst({ where: { id, tenantId: user.tenantId } })
    if (!before) return reply.status(404).send({ error: 'Course not found' })

    const updated = await app.prisma.course.update({
      where: { id },
      data:  body as any,
    })

    await app.audit(req, { action: 'course.update', resource: 'Course', resourceId: id, before, after: updated })
    return updated
  })

  /** POST /courses/:id/publish */
  app.post('/:id/publish', { onRequest: [requireRole(['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user   = (req as any).user

    const course = await app.prisma.course.updateMany({
      where: { id, tenantId: user.tenantId },
      data:  { status: 'PUBLISHED', publishedAt: new Date() },
    })

    if (!course.count) return reply.status(404).send({ error: 'Course not found' })
    await app.audit(req, { action: 'course.publish', resource: 'Course', resourceId: id })
    return { success: true }
  })

  /** DELETE /courses/:id */
  app.delete('/:id', { onRequest: [requireRole(['TENANT_ADMIN', 'SUPER_ADMIN'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user   = (req as any).user
    await app.prisma.course.deleteMany({ where: { id, tenantId: user.tenantId } })
    await app.audit(req, { action: 'course.delete', resource: 'Course', resourceId: id })
    return reply.status(204).send()
  })
}
