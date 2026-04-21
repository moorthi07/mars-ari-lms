#!/usr/bin/env node
/**
 * Mars-ari LMS — First-run setup script
 * Usage: node infra/scripts/setup.mjs
 */

import { execSync }   from 'child_process'
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '../..')

const log  = (msg) => console.log(`\x1b[36m▶\x1b[0m  ${msg}`)
const ok   = (msg) => console.log(`\x1b[32m✓\x1b[0m  ${msg}`)
const warn = (msg) => console.log(`\x1b[33m⚠\x1b[0m  ${msg}`)
const fail = (msg) => { console.log(`\x1b[31m✗\x1b[0m  ${msg}`); process.exit(1) }
const run  = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })

console.log('\n\x1b[1m🚀 Mars-ari LMS Setup\x1b[0m\n')

// ── 1. Environment file ───────────────────────────────────────────────────────
const envPath    = resolve(ROOT, '.env')
const envExample = resolve(ROOT, '.env.example')

if (!existsSync(envPath)) {
  log('Creating .env from .env.example...')
  copyFileSync(envExample, envPath)
  let env = readFileSync(envPath, 'utf8')
  env = env
    .replace('marsari_secret',                      randomBytes(16).toString('hex'))
    .replace('redis_secret',                        randomBytes(16).toString('hex'))
    .replace('Admin_change_me_123',                 'Admin_' + randomBytes(8).toString('hex'))
    .replace('changeme_in_production_min_32_chars', randomBytes(32).toString('hex'))
    .replace('admin_secret',                        randomBytes(10).toString('hex'))
    .replace(/change_me_in_production/g,            randomBytes(16).toString('hex'))
  writeFileSync(envPath, env)
  ok('.env created with auto-generated secrets')
} else {
  ok('.env already exists — skipping')
}

// ── 2. Parse .env into process.env ───────────────────────────────────────────
const rawEnv = readFileSync(envPath, 'utf8')
for (const line of rawEnv.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const idx = t.indexOf('=')
  if (idx === -1) continue
  process.env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim()
}

const PG_USER = process.env.POSTGRES_USER ?? 'marsari'
const PG_PASS = process.env.POSTGRES_PASSWORD ?? 'marsari_secret'
const PG_DB   = process.env.POSTGRES_DB   ?? 'mars_ari_lms'
const PG_PORT = process.env.POSTGRES_PORT ?? '5434'

// Build and inject DATABASE_URL
const DATABASE_URL = `postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}`
process.env.DATABASE_URL = DATABASE_URL

// Append DATABASE_URL to .env if not already there
if (!rawEnv.includes('DATABASE_URL=')) {
  writeFileSync(envPath, rawEnv.trimEnd() + `\nDATABASE_URL=${DATABASE_URL}\n`)
  ok(`DATABASE_URL added to .env`)
}

// ── 3. Copy .env to apps/api for Prisma ──────────────────────────────────────
copyFileSync(envPath, resolve(ROOT, 'apps/api/.env'))
ok('.env copied to apps/api/.env')

// ── 4. Prerequisites ──────────────────────────────────────────────────────────
log('Checking prerequisites...')
for (const tool of ['docker', 'node', 'npm']) {
  try { execSync(`which ${tool}`, { stdio: 'ignore' }); ok(`${tool} found`) }
  catch { fail(`${tool} not found — please install it`) }
}
try { execSync('docker compose version', { stdio: 'ignore' }); ok('docker compose v2 found') }
catch { fail('docker compose v2 not found') }

// ── 5. Start infrastructure ───────────────────────────────────────────────────
log('Starting infrastructure containers (postgres, redis, opensearch, keycloak, minio)...')
run('docker compose up -d postgres redis opensearch keycloak minio')
ok('Containers started')

// ── 6. Wait for postgres ──────────────────────────────────────────────────────
log('Waiting for PostgreSQL...')
let pgReady = false
for (let i = 0; i < 30; i++) {
  try {
    execSync(`docker exec mars-ari-postgres pg_isready -U postgres`, { stdio: 'ignore' })
    pgReady = true; break
  } catch { process.stdout.write('.'); await new Promise(r => setTimeout(r, 2000)) }
}
if (!pgReady) fail('PostgreSQL did not become ready in time')
console.log(''); ok('PostgreSQL ready')

// ── 7. Create DB user and database ───────────────────────────────────────────
log(`Setting up database user '${PG_USER}' and database '${PG_DB}'...`)

const psql = (sql, db = 'postgres') => {
  try {
    execSync(`docker exec mars-ari-postgres psql -U postgres -d ${db} -c "${sql}"`, { stdio: 'ignore' })
    return true
  } catch { return false }
}

psql(`CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';`)
psql(`ALTER USER ${PG_USER} CREATEDB;`)
psql(`CREATE DATABASE ${PG_DB} OWNER ${PG_USER};`)
psql(`GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};`)
psql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`, PG_DB)
psql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`, PG_DB)
psql(`CREATE SCHEMA IF NOT EXISTS keycloak;`, PG_DB)
psql(`GRANT ALL ON SCHEMA keycloak TO ${PG_USER};`, PG_DB)
ok(`Database '${PG_DB}' and user '${PG_USER}' ready`)

// ── 8. Install npm dependencies ───────────────────────────────────────────────
log('Installing npm dependencies...')
run('npm install --legacy-peer-deps')
ok('Dependencies installed')

// ── 9. Prisma generate + migrate ─────────────────────────────────────────────
log('Generating Prisma client...')
run('npm run db:generate --workspace=apps/api')
ok('Prisma client generated')

log('Running database migrations...')
run('npm run db:migrate --workspace=apps/api -- --name init')
ok('Migrations applied')

// ── 10. Seed ──────────────────────────────────────────────────────────────────
log('Seeding demo data...')
run('npm run db:seed --workspace=apps/api')
ok('Demo data seeded')

// ── 11. Start app ─────────────────────────────────────────────────────────────
log('Starting API, worker, and web...')
run('docker compose up -d api worker web')
ok('Application services started')

// ── 12. Summary ───────────────────────────────────────────────────────────────
const apiPort = process.env.API_PORT || 3001
const webPort = process.env.WEB_PORT || 3000
const kcPort = process.env.KEYCLOAK_PORT || 8082

console.log('\n\x1b[1m✅ Mars-ari LMS is up and running!\x1b[0m\n')
console.log(`  🌐 Web UI                →  http://localhost:${webPort}`)
console.log(`  🔌 API                   →  http://localhost:${apiPort}`)
console.log(`  📖 API Docs              →  http://localhost:${apiPort}/docs`)
console.log(`  🔐 Keycloak              →  http://localhost:${kcPort}`)
console.log('  🗃️  MinIO Console         →  http://localhost:9003')
console.log('  🔍 OpenSearch Dashboards →  http://localhost:5602')
console.log('\n\x1b[1mNext steps:\x1b[0m')
console.log('  1. Add an AI provider key to .env (ANTHROPIC_API_KEY recommended)')
console.log('  2. Set STRIPE_SECRET_KEY for payments')
console.log('  3. Set YOUTUBE_API_KEY for video search in AI Copilot\n')