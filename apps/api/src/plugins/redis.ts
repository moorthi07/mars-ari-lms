import fp from 'fastify-plugin'
import Redis from 'ioredis'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  })

  redis.on('error', (err) => app.log.error({ err }, 'Redis error'))
  redis.on('connect', () => app.log.info('Redis connected'))

  app.decorate('redis', redis)
  app.addHook('onClose', async () => redis.quit())
}

export const redisPlugin = fp(plugin, { name: 'redis' })
