import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middleware/auth-guard.js'

export const assessmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth)
  app.post('/attempts', async (req, reply) => {
    const user = (req as any).user
    const { quizId, answers } = req.body as { quizId: string; answers: Record<string, unknown> }
    const quiz = await app.prisma.quiz.findUnique({
      where: { id: quizId }, include: { questions: true },
    })
    if (!quiz) return reply.status(404).send({ error: 'Quiz not found' })

    // Simple grading: count correct answers
    let correct = 0
    for (const q of quiz.questions) {
      const userAnswer = answers[q.id]
      if (JSON.stringify(userAnswer) === JSON.stringify(q.answer)) correct++
    }
    const score  = Math.round((correct / quiz.questions.length) * 100)
    const passed = score >= quiz.passingScore

    const attempt = await app.prisma.quizAttempt.create({
      data: { quizId, userId: user.id, answers, score, passed },
    })
    return reply.status(201).send({ ...attempt, correct, total: quiz.questions.length })
  })
}
