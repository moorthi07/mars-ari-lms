import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middleware/auth-guard.js'

export const authRoutes: FastifyPluginAsync = async (app) => {
  /** GET /auth/me — returns the mars-ari user record, creates it on first login */
  app.get('/me', { onRequest: [requireAuth] }, async (req) => {
    return (req as any).user
  })

  /** POST /auth/sync — called on first Keycloak login to create/update marsari db user */
  app.post('/sync', async (req, reply) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing token' })
    }
    const token = authHeader.slice(7)

    // Verify via Keycloak JWKS
    let payload: any
    try {
      payload = await (app as any).verifyKeycloakToken(token)
    } catch {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    const { sub: keycloakId, email, name, preferred_username } = payload

    // Find or create tenant based on first part of email domain
    const domain = email?.split('@')[1] ?? 'default'
    let tenant = await app.prisma.tenant.findFirst({ where: { domain } })
    if (!tenant) {
      // Default tenant fallback
      tenant = await app.prisma.tenant.findFirst({ where: { slug: 'demo' } })
      if (!tenant) {
        tenant = await app.prisma.tenant.create({
          data: { slug: domain.replace(/\./g, '-'), name: domain, domain },
        })
      }
    }

    const user = await app.prisma.user.upsert({
      where:  { keycloakId },
      create: {
        keycloakId,
        tenantId:    tenant.id,
        email:       email ?? '',
        displayName: name ?? preferred_username ?? email ?? 'User',
        role:        'STUDENT',
      },
      update: {
        email:       email ?? undefined,
        displayName: name ?? preferred_username ?? undefined,
        lastLoginAt: new Date(),
      },
    })

    return user
  })
}
