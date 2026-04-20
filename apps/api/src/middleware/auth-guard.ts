import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role } from '@prisma/client'

export interface AuthUser {
  id:         string
  keycloakId: string
  tenantId:   string
  email:      string
  role:       Role
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await req.jwtVerify()
    const payload = req.user as any

    // Hydrate user from DB for fresh role/tenantId
    const user = await (req.server as any).prisma.user.findUnique({
      where: { keycloakId: payload.sub },
      select: { id: true, keycloakId: true, tenantId: true, email: true, role: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'INVALID_USER' })
    }

    req.user = user
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', code: 'MISSING_TOKEN' })
  }
}

const ROLE_HIERARCHY: Record<Role, number> = {
  GUEST:        0,
  STUDENT:      1,
  INSTRUCTOR:   2,
  TENANT_ADMIN: 3,
  SUPER_ADMIN:  4,
}

export function requireRole(allowed: Role[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.user
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userLevel = ROLE_HIERARCHY[user.role]
    const minRequired = Math.min(...allowed.map((r) => ROLE_HIERARCHY[r]))
    if (userLevel < minRequired) {
      return reply.status(403).send({
        error: 'Forbidden',
        code:  'INSUFFICIENT_ROLE',
        required: allowed,
        current:  user.role,
      })
    }
  }
}

export function requireTenantAccess() {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.user
    const { tenantId } = req.params as { tenantId?: string }
    if (user?.role === 'SUPER_ADMIN') return
    if (tenantId && user?.tenantId !== tenantId) {
      return reply.status(403).send({ error: 'Forbidden', code: 'TENANT_MISMATCH' })
    }
  }
}
