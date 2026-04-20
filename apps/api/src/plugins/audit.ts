import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

export interface AuditEntry {
  action:     string
  resource:   string
  resourceId?: string
  before?:    unknown
  after?:     unknown
}

declare module 'fastify' {
  interface FastifyInstance {
    audit: (req: FastifyRequest, entry: AuditEntry) => Promise<void>
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorate('audit', async (req: FastifyRequest, entry: AuditEntry) => {
    const user = (req as any).user
    if (!user) return

    const record = {
      tenantId:   user.tenantId,
      userId:     user.id,
      action:     entry.action,
      resource:   entry.resource,
      resourceId: entry.resourceId ?? null,
      before:     entry.before ?? null,
      after:      entry.after  ?? null,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'] ?? null,
    }

    // Write to Postgres (durable)
    await app.prisma.auditLog.create({ data: record }).catch((err: unknown) =>
      app.log.error({ err }, 'Audit log DB write failed')
    )

    // Index to OpenSearch (searchable)
    await app.opensearch.index({
      index: 'mars-ari-audit-logs',
      body:  { ...record, createdAt: new Date().toISOString() },
    }).catch((err: unknown) =>
      app.log.warn({ err }, 'Audit log OpenSearch write failed')
    )
  })
}

export const auditPlugin = fp(plugin, { name: 'audit' })
