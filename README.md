# Mars-ari LMS 🎓

> **Mars-ari — Open-source Agentic LMS** — AI course copilot that generates complete curricula, lessons, quizzes, and media automatically. Self-hostable, multi-tenant, bring-your-own-LLM.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://docker.com)

---

## What makes Mars-ari LMS different

Most open-source LMS platforms (Moodle, Open edX) have no native AI content generation. Mars-ari ships an **AI Copilot Studio** that:

- Takes a course title + description
- Generates a full curriculum with modules, lessons, and quizzes via **streaming AI**
- Auto-searches and embeds **YouTube videos** per lesson
- Generates **AI images** (DALL-E/Imagen) per concept
- Populates all content fields in real time as you watch
- Supports **any LLM** — Claude, GPT-4o, Gemini, Ollama (local), Groq, Mistral, or any OpenAI-compatible API (BYOK)

---

## Architecture

```
apps/
  api/          TypeScript + Fastify REST API
  web/          React + Vite + Tailwind SPA
packages/
  types/        Shared TypeScript types
  sdk/          @mars-ari/sdk — external platform integration SDK
infra/
  docker/       Service configs
  keycloak/     Realm + client export
  caddy/        Production TLS reverse proxy
  scripts/      setup.mjs (one-command bootstrap)
```

### Infrastructure stack

| Service | Purpose |
|---|---|
| PostgreSQL 16 | Primary database (Prisma ORM) |
| Redis 7 | Cache + BullMQ job queues |
| OpenSearch 2.12 | Full-text search + audit log indexing |
| Keycloak 24 | SSO, OIDC, SAML, SCIM — own auth or federate |
| MinIO | S3-compatible media storage |
| Caddy | Auto-TLS reverse proxy (production) |

---

## Quick start

### Prerequisites
- Docker + Docker Compose v2
- Node.js 20+
- npm 10+

### One-command setup

```bash
git clone https://github.com/your-org/mars-ari-lms.git
cd mars-ari-lms
node infra/scripts/setup.mjs
```

The setup script:
1. Copies `.env.example` → `.env` with auto-generated secrets
2. Starts all infrastructure containers
3. Runs Prisma migrations
4. Seeds demo data (tenant, users, sample course, integrations)
5. Starts API + worker + web

### Manual setup

```bash
cp .env.example .env
# Edit .env — add your AI provider keys etc.

docker compose up -d postgres redis opensearch keycloak minio

npm install
npm run db:migrate --workspace=apps/api
npm run db:seed    --workspace=apps/api

docker compose up -d api worker web
```

### Access points

| Service | URL |
|---|---|
| Web UI | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Keycloak Admin | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`.

### Required

```env
DATABASE_URL=postgresql://marsari:marsari_secret@localhost:5432/mars_ari_lms
REDIS_URL=redis://:redis_secret@localhost:6379
JWT_SECRET=<32+ random chars>
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_CLIENT_SECRET=<from keycloak admin>
```

### AI providers — at least one required

```env
ANTHROPIC_API_KEY=sk-ant-...       # Claude (recommended)
OPENAI_API_KEY=sk-...              # GPT-4o + DALL-E image generation
GOOGLE_AI_API_KEY=...              # Gemini
GROQ_API_KEY=...                   # Groq (fast inference)
OLLAMA_BASE_URL=http://localhost:11434  # Local Ollama
```

### Optional

```env
YOUTUBE_API_KEY=...                # YouTube Data API v3 — for video search
STRIPE_SECRET_KEY=sk_test_...      # Payments
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Per-tenant AI config (BYOK)

Each tenant can set their own LLM provider and API key via the admin panel or API:

```
PUT /api/v1/tenants/me/ai-config
{
  "provider": "ANTHROPIC",
  "model": "claude-sonnet-4-6",
  "apiKey": "sk-ant-...",
  "isDefault": true
}
```

---

## Platform integration

Mars-ari LMS supports three integration modes for connecting external platforms (like your robotics teleop system):

### 1. Link (simplest)

Open LMS content directly from your platform:

```typescript
import MarsAriLMS from '@mars-ari/sdk'

const lms = new MarsAriLMS({
  baseUrl:    'https://lms.your-org.com',
  apiKey:     'marsari_key_...',
  tenantSlug: 'your-tenant',
})

// Open course in new tab
window.open(lms.courseLink('teleoperator-fundamentals', userJwt))

// Embed lesson in your UI
lms.embed({ lessonId: '...', containerId: 'lesson-area' })
```

### 2. SDK (embedded)

Embed Mars-ari lessons as iframes with postMessage event bridge:

```typescript
const cleanup = lms.embed({
  lessonId:    'lesson-uuid',
  containerId: 'lesson-container',
  userToken:   currentUser.jwt,
  height:      '700px',
})

lms.onEvent('LESSON_COMPLETED', (event) => {
  console.log('Lesson done:', event.data)
  unlockNextRobotTask(event.data.lessonId)
})
```

### 3. Webhook (server-to-server)

Receive LMS events on your backend:

```typescript
// Configure in Mars-ari LMS admin panel or API:
// POST /api/v1/integrations
// { type: "WEBHOOK", webhookUrl: "https://your-platform.com/lms-events",
//   webhookEvents: ["COURSE_ENROLLED", "COURSE_COMPLETED", "QUIZ_PASSED"] }

// On your server (Express example):
app.post('/lms-events', express.raw({ type: 'application/json' }), async (req, res) => {
  const valid = await lms.verifyWebhook(req.body, req.headers['x-marsari-signature'], secret)
  if (!valid) return res.status(401).end()

  const event = JSON.parse(req.body)
  switch (event.event) {
    case 'COURSE_COMPLETED':
      await grantRobotOperatorAccess(event.data.userId)
      break
    case 'QUIZ_PASSED':
      await unlockNextTrainingLevel(event.data.userId)
      break
  }
  res.send({ ok: true })
})
```

---

## AI Copilot Studio

The Copilot Studio is the key differentiating feature. Instructors use it to generate full courses from a prompt.

### Workflow

1. Open Copilot Studio (`/copilot`)
2. Enter course title + description + optional target audience
3. Click **Generate** — curriculum streams in real time
4. Review modules and lessons in the live preview
5. Click **Create course** — saves the full structure to the database
6. Use **Enrich Media** to auto-attach YouTube videos and AI images per lesson
7. Publish when ready

### API

The copilot is also fully accessible via API:

```bash
# Generate curriculum (SSE stream)
curl -N -X POST http://localhost:3001/api/v1/ai-copilot/generate-curriculum \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Intro to Teleoperation","description":"...","stream":true}'

# Generate quiz questions
curl -X POST http://localhost:3001/api/v1/ai-copilot/generate-quiz \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseTitle":"...","lessonTitle":"...","objectives":["..."],"questionCount":10}'
```

---

## Multi-tenancy & white-labeling

Each tenant gets:
- Isolated data (row-level tenantId on every table)
- Custom domain support
- Per-tenant branding: logo, primary color, accent color, custom CSS
- Per-tenant LLM provider configuration (BYOK)
- Separate Stripe customer for billing

---

## Role-based access control

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | All tenants, all data |
| `TENANT_ADMIN` | Full access within their tenant |
| `INSTRUCTOR` | Create/edit courses, use AI Copilot |
| `STUDENT` | Enroll, view published content, take quizzes |
| `GUEST` | View free preview lessons only |

---

## Build phases

### Phase 1 (this scaffold) ✅
- Full repo scaffold with Docker Compose
- Prisma schema (all models)
- API skeleton: all routes stubbed, courses + enrollments + integrations fully implemented
- AI Copilot: all 4 agents (curriculum, content, media, quiz)
- SSE streaming endpoint
- Auth: Keycloak plugin + JWT guard + role middleware
- Audit logging (Postgres + OpenSearch)
- Background worker (BullMQ)
- Web: Copilot Studio UI, Dashboard, Sidebar, auth store
- Integration SDK (`@mars-ari/sdk`)
- Demo seed (teleop courses + webhook/link/SDK integrations)
- One-command setup script

### Phase 2
- Full lesson player (video, code sandbox, slide viewer)
- Quiz engine UI with timer and instant feedback
- Stripe checkout + invoice management
- MinIO presigned upload + CDN delivery
- Email notifications (enrollment, completion, cert)
- Full course catalog with search (OpenSearch)

### Phase 3
- Certificate PDF generation
- OpenSearch Dashboards analytics
- Keycloak SCIM user sync
- Mobile PWA offline support
- Kubernetes Helm chart

---

## License

MIT — see [LICENSE](LICENSE)

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Mars-ari LMS — built with ❤️. Open-source alternative to Coursebox, Synthesia, and other closed AI course platforms.
