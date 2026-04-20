import type { FastifyReply, FastifyRequest } from 'fastify'

export async function requestLogger(
  req: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Skip health checks from logs to reduce noise
  if (req.url === '/health') return

  req.log.info({
    method:    req.method,
    url:       req.url,
    userAgent: req.headers['user-agent'],
    ip:        req.ip,
  }, 'incoming request')
}
