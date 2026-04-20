import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth-guard.js'
import { dispatchWebhookEvent } from '../integrations/routes.js'

export const enrollmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)

  /** GET /enrollments/me — my enrollments with progress */
  app.get('/me', async (req) => {
    const user = (req as any).user
    return app.prisma.enrollment.findMany({
      where: { userId: user.id },
      include: {
        course: {
          select: {
            id: true, title: true, thumbnailUrl: true, level: true,
            estimatedHours: true, _count: { select: { modules: true } },
          },
        },
        _count: { select: { lessonProgress: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    })
  })

  /** POST /enrollments — enroll in a course */
  app.post('/', async (req, reply) => {
    const user = (req as any).user
    const { courseId } = z.object({ courseId: z.string().uuid() }).parse(req.body)

    // Check course exists and is published
    const course = await app.prisma.course.findFirst({
      where: { id: courseId, tenantId: user.tenantId, status: 'PUBLISHED' },
    })
    if (!course) return reply.status(404).send({ error: 'Course not found or not available' })

    // Check already enrolled
    const existing = await app.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    })
    if (existing) return reply.status(409).send({ error: 'Already enrolled', enrollment: existing })

    const enrollment = await app.prisma.enrollment.create({
      data: { userId: user.id, courseId },
    })

    // Dispatch webhook event
    await dispatchWebhookEvent(app.prisma, user.tenantId, 'COURSE_ENROLLED', {
      userId:       user.id,
      courseId:     course.id,
      courseTitle:  course.title,
      enrollmentId: enrollment.id,
      enrolledAt:   enrollment.enrolledAt,
    })

    return reply.status(201).send(enrollment)
  })

  /** POST /enrollments/:enrollmentId/lessons/:lessonId/complete */
  app.post('/:enrollmentId/lessons/:lessonId/complete', async (req, reply) => {
    const user = (req as any).user
    const { enrollmentId, lessonId } = req.params as { enrollmentId: string; lessonId: string }

    const enrollment = await app.prisma.enrollment.findFirst({
      where: { id: enrollmentId, userId: user.id },
      include: { course: true },
    })
    if (!enrollment) return reply.status(404).send({ error: 'Enrollment not found' })

    await app.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId },
      update: { completedAt: new Date() },
    })

    // Check if course is fully complete
    const [totalLessons, completedLessons] = await Promise.all([
      app.prisma.lesson.count({ where: { module: { courseId: enrollment.courseId }, isPublished: true } }),
      app.prisma.lessonProgress.count({ where: { enrollmentId } }),
    ])

    if (totalLessons > 0 && completedLessons >= totalLessons) {
      await app.prisma.enrollment.update({
        where: { id: enrollmentId },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      })
      // Dispatch course completion webhook
      await dispatchWebhookEvent(app.prisma, user.tenantId, 'COURSE_COMPLETED', {
        userId:      user.id,
        courseId:    enrollment.courseId,
        courseTitle: enrollment.course.title,
        enrollmentId,
        completedAt: new Date(),
      })
    }

    return { success: true, progress: { completed: completedLessons, total: totalLessons } }
  })
}
