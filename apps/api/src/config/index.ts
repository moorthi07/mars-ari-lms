import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:          z.enum(['development', 'test', 'production']).default('development'),
  PORT:              z.coerce.number().default(3001),
  DATABASE_URL:      z.string().min(1),
  REDIS_URL:         z.string().min(1),
  OPENSEARCH_URL:    z.string().min(1),
  JWT_SECRET:        z.string().min(16),
  CORS_ORIGINS:      z.string().default('http://localhost:3000'),

  // Keycloak
  KEYCLOAK_URL:          z.string().url(),
  KEYCLOAK_REALM:        z.string().default('mars-ari'),
  KEYCLOAK_CLIENT_ID:    z.string(),
  KEYCLOAK_CLIENT_SECRET: z.string(),

  // MinIO / S3
  MINIO_ENDPOINT:    z.string(),
  MINIO_PORT:        z.coerce.number().default(9000),
  MINIO_ACCESS_KEY:  z.string(),
  MINIO_SECRET_KEY:  z.string(),
  MINIO_BUCKET:      z.string().default('mars-ari-media'),
  MINIO_USE_SSL:     z.coerce.boolean().default(false),

  // Stripe
  STRIPE_SECRET_KEY:      z.string().optional(),
  STRIPE_WEBHOOK_SECRET:  z.string().optional(),

  // AI Providers (all optional — BYOK)
  OPENAI_API_KEY:    z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY:      z.string().optional(),
  OLLAMA_BASE_URL:   z.string().url().optional(),

  // YouTube
  YOUTUBE_API_KEY:   z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data

export const config = {
  isDev:         env.NODE_ENV === 'development',
  isProd:        env.NODE_ENV === 'production',
  port:          env.PORT,
  databaseUrl:   env.DATABASE_URL,
  redisUrl:      env.REDIS_URL,
  opensearchUrl: env.OPENSEARCH_URL,
  jwtSecret:     env.JWT_SECRET,
  logLevel:      env.LOG_LEVEL,
  corsOrigins:   env.CORS_ORIGINS.split(',').map((s) => s.trim()),

  keycloak: {
    url:          env.KEYCLOAK_URL,
    realm:        env.KEYCLOAK_REALM,
    clientId:     env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET,
  },

  minio: {
    endpoint:  env.MINIO_ENDPOINT,
    port:      env.MINIO_PORT,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    bucket:    env.MINIO_BUCKET,
    useSsl:    env.MINIO_USE_SSL,
  },

  stripe: {
    secretKey:     env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  ai: {
    openai:    env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    google:    env.GOOGLE_AI_API_KEY,
    groq:      env.GROQ_API_KEY,
    ollamaUrl: env.OLLAMA_BASE_URL,
  },

  youtube: {
    apiKey: env.YOUTUBE_API_KEY,
  },
} as const

export type Config = typeof config
