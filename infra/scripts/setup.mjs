#!/usr/bin/env node
/**
 * Mars-ari LMS — First-run setup script
 * Usage: node infra/scripts/setup.mjs
 *
 * Guides you through:
 *  1. Copy .env.example → .env and fill in secrets
 *  2. Validate required env vars
 *  3. Start infrastructure containers
 *  4. Run Prisma migrations
 *  5. Seed demo data
 *  6. Print access URLs
 */

import { execSync }   from 'child_process'
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '../..')

const log  = (msg) => console.log(`\x1b[36m▶\x1b[0m ${msg}`)
const ok   = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`)
const warn = (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`)
const err  = (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`)

console.log('\n\x1b[1m🚀 Mars-ari LMS Setup\x1b[0m\n')

// ── 1. Environment file ───────────────────────────────────────────────────────
const envPath    = resolve(ROOT, '.env')
const envExample = resolve(ROOT, '.env.example')

if (!existsSync(envPath)) {
  log('Creating .env from .env.example...')
  copyFileSync(envExample, envPath)

  // Generate secure random values for secrets
  let env = readFileSync(envPath, 'utf8')
  env = env
    .replace('marsari_secret',           randomBytes(16).toString('hex'))
    .replace('redis_secret',          randomBytes(16).toString('hex'))
    .replace('changeme_in_production_use_32+_chars', randomBytes(32).toString('hex'))
    .replace('admin_secret',          randomBytes(12).toString('hex'))
  writeFileSync(envPath, env)
  ok('.env created with auto-generated secrets')
} else {
  ok('.env already exists — skipping creation')
}

// ── 2. Check required tools ───────────────────────────────────────────────────
log('Checking prerequisites...')

const tools = ['docker', 'node', 'npm']
for (const tool of tools) {
  try {
    execSync(`which ${tool}`, { stdio: 'ignore' })
    ok(`${tool} found`)
  } catch {
    err(`${tool} not found — please install it first`)
    process.exit(1)
  }
}

// Check docker compose v2
try {
  execSync('docker compose version', { stdio: 'ignore' })
  ok('docker compose v2 found')
} catch {
  err('docker compose v2 not found. Install Docker Desktop or the Compose plugin.')
  process.exit(1)
}

// ── 3. Start infrastructure ───────────────────────────────────────────────────
log('Starting infrastructure services (postgres, redis, opensearch, keycloak, minio)...')
log('This may take 2-5 minutes on first run while images are pulled...\n')

try {
  execSync(
    'docker compose up -d postgres redis opensearch keycloak minio',
    { cwd: ROOT, stdio: 'inherit' }
  )
  ok('Infrastructure services started')
} catch {
  err('Failed to start services — check docker compose logs for details')
  process.exit(1)
}

// ── 4. Wait for postgres ──────────────────────────────────────────────────────
log('Waiting for PostgreSQL to be ready...')
let attempts = 0
while (attempts < 30) {
  try {
    execSync('docker compose exec -T postgres pg_isready -U marsari', { cwd: ROOT, stdio: 'ignore' })
    ok('PostgreSQL is ready')
    break
  } catch {
    attempts++
    if (attempts === 30) { err('PostgreSQL did not become ready in time'); process.exit(1) }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

// ── 5. Install dependencies ───────────────────────────────────────────────────
log('Installing npm dependencies...')
execSync('npm install', { cwd: ROOT, stdio: 'inherit' })
ok('Dependencies installed')

// ── 6. Prisma migrate + generate ─────────────────────────────────────────────
log('Running database migrations...')
execSync('npm run db:migrate --workspace=apps/api -- --name init', { cwd: ROOT, stdio: 'inherit' })
ok('Migrations applied')

// ── 7. Seed demo data ─────────────────────────────────────────────────────────
log('Seeding demo data...')
execSync('npm run db:seed --workspace=apps/api', { cwd: ROOT, stdio: 'inherit' })
ok('Demo data seeded')

// ── 8. Start application services ────────────────────────────────────────────
log('Starting API and web services...')
execSync('docker compose up -d api worker web', { cwd: ROOT, stdio: 'inherit' })
ok('Application services started')

// ── 9. Print summary ──────────────────────────────────────────────────────────
console.log('\n\x1b[1m✅ Mars-ari LMS is running!\x1b[0m\n')
console.log('  🌐 Web UI        →  http://localhost:3000')
console.log('  🔌 API           →  http://localhost:3001')
console.log('  📖 API Docs      →  http://localhost:3001/docs')
console.log('  🔐 Keycloak      →  http://localhost:8080')
console.log('  🗄️  MinIO Console →  http://localhost:9001')
console.log('\n\x1b[1mDemo accounts\x1b[0m (set passwords in Keycloak admin):')
console.log('  admin@demo.marsarilms.io      — Tenant Admin')
console.log('  instructor@demo.marsarilms.io — Instructor')
console.log('  student@demo.marsarilms.io    — Student')
console.log('\n\x1b[1mNext steps:\x1b[0m')
console.log('  1. Configure AI provider keys in .env (OPENAI_API_KEY / ANTHROPIC_API_KEY / etc.)')
console.log('  2. Set Stripe keys for payments (STRIPE_SECRET_KEY)')
console.log('  3. Set YOUTUBE_API_KEY for video search in AI Copilot')
console.log('  4. Open AI Copilot Studio and generate your first course!')
console.log('  5. See README.md for full configuration reference\n')
