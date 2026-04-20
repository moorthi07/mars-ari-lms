import fp from 'fastify-plugin'
import { Client } from '@opensearch-project/opensearch'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    opensearch: Client
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  const client = new Client({
    node: config.opensearchUrl,
    ssl:  { rejectUnauthorized: false }, // set true in prod with proper certs
  })

  try {
    await client.cluster.health({})
    app.log.info('OpenSearch connected')
  } catch (err) {
    app.log.warn({ err }, 'OpenSearch not available — search/logging degraded')
  }

  // Ensure indices exist
  await ensureIndices(client)

  app.decorate('opensearch', client)
  app.addHook('onClose', async () => client.close())
}

async function ensureIndices(client: Client) {
  const indices = [
    {
      index: 'mars-ari-courses',
      body: {
        mappings: {
          properties: {
            tenantId:    { type: 'keyword' },
            title:       { type: 'text', analyzer: 'english' },
            description: { type: 'text', analyzer: 'english' },
            tags:        { type: 'keyword' },
            level:       { type: 'keyword' },
            status:      { type: 'keyword' },
            createdAt:   { type: 'date' },
          },
        },
      },
    },
    {
      index: 'mars-ari-audit-logs',
      body: {
        mappings: {
          properties: {
            tenantId:   { type: 'keyword' },
            userId:     { type: 'keyword' },
            action:     { type: 'keyword' },
            resource:   { type: 'keyword' },
            resourceId: { type: 'keyword' },
            ip:         { type: 'ip' },
            createdAt:  { type: 'date' },
          },
        },
      },
    },
  ]

  for (const { index, body } of indices) {
    const exists = await client.indices.exists({ index })
    if (!exists.body) {
      await client.indices.create({ index, body })
    }
  }
}

export const opensearchPlugin = fp(plugin, { name: 'opensearch' })
