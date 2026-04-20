import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const log = request.log

  // Zod validation error
  if (error instanceof ZodError) {
    log.warn({ path: request.url, issues: error.issues }, 'Validation error')
    reply.status(400).send({
      error:   'Validation Error',
      code:    'VALIDATION_ERROR',
      issues:  error.issues.map((i) => ({
        path:    i.path.join('.'),
        message: i.message,
      })),
    })
    return
  }

  // Prisma unique constraint
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      reply.status(409).send({
        error:  'Conflict',
        code:   'DUPLICATE_ENTRY',
        detail: `Duplicate value on field: ${String(error.meta?.target)}`,
      })
      return
    }
    if (error.code === 'P2025') {
      reply.status(404).send({ error: 'Not Found', code: 'NOT_FOUND' })
      return
    }
  }

  // Fastify errors (e.g. rate limit)
  if ('statusCode' in error && error.statusCode) {
    log.warn({ err: error }, 'Fastify error')
    reply.status(error.statusCode).send({
      error: error.message,
      code:  error.code ?? 'FASTIFY_ERROR',
    })
    return
  }

  // Unhandled — 500
  log.error({ err: error, path: request.url }, 'Unhandled error')
  reply.status(500).send({
    error: 'Internal Server Error',
    code:  'INTERNAL_ERROR',
    ...(process.env['NODE_ENV'] === 'development' && {
      detail: error.message,
      stack:  error.stack,
    }),
  })
}
