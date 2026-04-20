import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { config } from './config/index.js'
import { prismaPlugin } from './plugins/prisma.js'
import { redisPlugin } from './plugins/redis.js'
import { opensearchPlugin } from './plugins/opensearch.js'
import { authPlugin } from './plugins/auth.js'
import { auditPlugin } from './plugins/audit.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'

// Route modules
import { authRoutes } from './modules/auth/routes.js'
import { tenantRoutes } from './modules/tenants/routes.js'
import { courseRoutes } from './modules/courses/routes.js'
import { moduleRoutes } from './modules/modules/routes.js'
import { lessonRoutes } from './modules/lessons/routes.js'
import { enrollmentRoutes } from './modules/enrollments/routes.js'
import { assessmentRoutes } from './modules/assessments/routes.js'
import { mediaRoutes } from './modules/media/routes.js'
import { paymentRoutes } from './modules/payments/routes.js'
import { webhookRoutes } from './modules/webhooks/routes.js'
import { integrationRoutes } from './modules/integrations/routes.js'
import { aiCopilotRoutes } from './modules/ai-copilot/routes.js'

const app = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.isDev
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
  ajv: {
    customOptions: { strict: false },
  },
})

async function bootstrap() {
  // ── Swagger (API docs) ───────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: { title: 'Mars-ari LMS API', version: '0.1.0', description: 'Mars-ari LMS REST API' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  // ── Core plugins ─────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  })
  await app.register(jwt, { secret: config.jwtSecret })
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis: undefined, // set after redis plugin is ready
  })
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } }) // 500MB

  // ── Infrastructure plugins ───────────────────────────────────────────────
  await app.register(prismaPlugin)
  await app.register(redisPlugin)
  await app.register(opensearchPlugin)
  await app.register(authPlugin)
  await app.register(auditPlugin)

  // ── Middleware ───────────────────────────────────────────────────────────
  app.addHook('onRequest', requestLogger)
  app.setErrorHandler(errorHandler)

  // ── Health ───────────────────────────────────────────────────────────────
  app.get('/health', { schema: { tags: ['system'] } }, async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))

  // ── API routes (v1) ──────────────────────────────────────────────────────
  const v1Prefix = '/api/v1'
  await app.register(authRoutes,        { prefix: `${v1Prefix}/auth` })
  await app.register(tenantRoutes,      { prefix: `${v1Prefix}/tenants` })
  await app.register(courseRoutes,      { prefix: `${v1Prefix}/courses` })
  await app.register(moduleRoutes,      { prefix: `${v1Prefix}/courses/:courseId/modules` })
  await app.register(lessonRoutes,      { prefix: `${v1Prefix}/modules/:moduleId/lessons` })
  await app.register(enrollmentRoutes,  { prefix: `${v1Prefix}/enrollments` })
  await app.register(assessmentRoutes,  { prefix: `${v1Prefix}/assessments` })
  await app.register(mediaRoutes,       { prefix: `${v1Prefix}/media` })
  await app.register(paymentRoutes,     { prefix: `${v1Prefix}/payments` })
  await app.register(webhookRoutes,     { prefix: `${v1Prefix}/webhooks` })
  await app.register(integrationRoutes, { prefix: `${v1Prefix}/integrations` })
  await app.register(aiCopilotRoutes,   { prefix: `${v1Prefix}/ai-copilot` })

  // ── Start ────────────────────────────────────────────────────────────────
  await app.listen({ port: config.port, host: '0.0.0.0' })
  app.log.info(`Mars-ari LMS API running on port ${config.port}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})

export { app }
