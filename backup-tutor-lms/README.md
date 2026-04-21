# Mars Ed — MarsGeo Robotics University LMS

## One Command. That's It.

```bash
bash lms/run.sh
```

**What it does:**
1. Installs Tutor (Open edX's official Docker distribution)
2. Configures Mars Ed branding
3. Pulls Docker images and starts all containers (MySQL, MongoDB, Redis, Elasticsearch, LMS, CMS)
4. Creates admin user automatically
5. Builds OLX packages from all course content
6. Imports all 3 courses
7. Applies Indigo theme

**First run:** 15-20 minutes (Docker image pulls ~3GB)  
**Subsequent runs:** 2-3 minutes

---

## Access After Running

| URL | What |
|-----|------|
| `http://localhost:8200` | LMS — learner view |
| `http://localhost:8201` | Studio — course authoring |
| `http://localhost:8200/admin` | Django admin |

**Admin credentials:** `marsed-admin` / `MarsEd2025!`

---

## Custom Credentials / Domain

```bash
export MARSED_ADMIN_USER=your-admin
export MARSED_ADMIN_EMAIL=you@yourdomain.com
export MARSED_ADMIN_PASS=YourPassword123
export MARSED_LMS_HOST=learn.marsgeo.io
export MARSED_PORT=8200
bash lms/run.sh
```

---

## Ports

| Port | Service |
|------|---------|
| 8200 | LMS (learner) |
| 8201 | Studio (authoring) |

No conflict with existing MarsGeo stack (3001, 8080, 8081, 5432, 5433, 6379).

---

## Containers Started (marsed namespace)

Tutor manages these automatically:
- `marsed-lms` — Open edX LMS
- `marsed-cms` — Open edX Studio
- `marsed-mysql` — MySQL 8
- `marsed-mongodb` — MongoDB 4.4
- `marsed-redis` — Redis 7
- `marsed-elasticsearch` — Elasticsearch 7
- `marsed-caddy` — Reverse proxy

---

## Re-import Courses After Content Changes

```bash
# Rebuild OLX and re-import
python3 lms/scripts/generate-olx.py course1-physical-ai-foundations lms/olx lms/courses/course1-physical-ai-foundations
cd lms/olx && tar -czf ../dist/course1.tar.gz course1-physical-ai-foundations/
tutor local do importcourse lms/dist/course1.tar.gz
```

---

## Stop / Start

```bash
tutor local stop    # Stop all containers
tutor local start   # Start again (no re-import needed)
```
