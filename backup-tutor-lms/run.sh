#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Mars Ed — MarsGeo Robotics University                         ║
# ║  One-command setup: installs, configures, populates, runs      ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   bash lms/run.sh
#
# Optional env overrides:
#   MARSED_ADMIN_USER=marsed-admin
#   MARSED_ADMIN_EMAIL=admin@marsgeo.io
#   MARSED_ADMIN_PASS=MarsEd2025!
#   MARSED_LMS_HOST=localhost          # or learn.marsgeo.io
#   MARSED_PORT=8200                   # LMS port (avoids conflict with your 8080)

set -e

# ── Config ────────────────────────────────────────────────────────────────
ADMIN_USER="${MARSED_ADMIN_USER:-marsed-admin}"
ADMIN_EMAIL="${MARSED_ADMIN_EMAIL:-admin@marsgeo.io}"
ADMIN_PASS="${MARSED_ADMIN_PASS:-MarsEd2025!}"
LMS_HOST="${MARSED_LMS_HOST:-localhost}"
LMS_PORT="${MARSED_PORT:-8200}"
CMS_PORT="${MARSED_CMS_PORT:-8201}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Mars Ed — MarsGeo Robotics University                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check prerequisites ───────────────────────────────────────────
log "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 not found. Install Python 3.8+."
  exit 1
fi

ok "Docker and Python3 found"

# ── Step 2: Install Tutor ─────────────────────────────────────────────────
log "Installing Tutor (Open edX Docker distribution)..."

pip3 install --quiet --user "tutor[full]" 2>/dev/null || \
pip install --quiet --user "tutor[full]" 2>/dev/null || true

# Ensure tutor is in PATH
export PATH="$HOME/.local/bin:$PATH"

if ! command -v tutor &>/dev/null; then
  warn "Tutor not in PATH. Trying pip install without --user..."
  pip3 install --quiet "tutor[full]" 2>/dev/null || pip install --quiet "tutor[full]"
  export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
fi

TUTOR_VERSION=$(tutor --version 2>/dev/null | head -1 || echo "unknown")
ok "Tutor installed: $TUTOR_VERSION"

# ── Step 3: Configure Mars Ed ─────────────────────────────────────────────
log "Configuring Mars Ed branding..."

tutor config save \
  --set PLATFORM_NAME="Mars Ed — MarsGeo Robotics University" \
  --set LMS_HOST="$LMS_HOST" \
  --set CMS_HOST="$LMS_HOST" \
  --set CONTACT_EMAIL="$ADMIN_EMAIL" \
  --set ENABLE_HTTPS=false \
  --set LMS_PORT="$LMS_PORT" \
  --set CMS_PORT="$CMS_PORT" \
  2>/dev/null || true

ok "Configuration saved"

# ── Step 4: Launch Open edX ───────────────────────────────────────────────
log "Launching Open edX (first run: 10-20 min for Docker image pulls)..."
echo "   This will pull ~3GB of Docker images on first run."
echo ""

tutor local launch --non-interactive

ok "Open edX is running"

# ── Step 5: Create admin user ─────────────────────────────────────────────
log "Creating admin user: $ADMIN_USER..."

tutor local do createuser \
  --staff \
  --superuser \
  "$ADMIN_USER" \
  "$ADMIN_EMAIL" \
  --password "$ADMIN_PASS" 2>/dev/null || \
warn "Admin user may already exist — continuing"

ok "Admin user ready: $ADMIN_USER / $ADMIN_PASS"

# ── Step 6: Build OLX packages ────────────────────────────────────────────
log "Building course OLX packages..."

mkdir -p "$SCRIPT_DIR/olx"
mkdir -p "$SCRIPT_DIR/dist"

for course in course1-physical-ai-foundations course2-teleop-controller course3-teleop-trainer; do
  if [ -d "$SCRIPT_DIR/courses/$course" ]; then
    python3 "$SCRIPT_DIR/scripts/generate-olx.py" \
      "$course" \
      "$SCRIPT_DIR/olx" \
      "$SCRIPT_DIR/courses/$course"

    cd "$SCRIPT_DIR/olx"
    tar -czf "$SCRIPT_DIR/dist/$course.tar.gz" "$course/"
    ok "Built: $course.tar.gz"
  else
    warn "Course directory not found: $SCRIPT_DIR/courses/$course — skipping"
  fi
done

# ── Step 7: Import courses ────────────────────────────────────────────────
log "Importing courses into Open edX..."

for course_zip in "$SCRIPT_DIR/dist/"*.tar.gz; do
  if [ -f "$course_zip" ]; then
    course_name=$(basename "$course_zip" .tar.gz)
    echo "   Importing: $course_name..."
    tutor local do importcourse "$course_zip" && ok "$course_name imported" || warn "Import failed for $course_name — check logs"
  fi
done

# ── Step 8: Apply theme ───────────────────────────────────────────────────
log "Applying Indigo theme (modern UI)..."
tutor local do settheme indigo 2>/dev/null && ok "Theme applied" || warn "Theme apply failed — default theme will be used"
tutor local restart 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Mars Ed is fully populated and running!            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  🌐 LMS (learner):  http://$LMS_HOST:$LMS_PORT          ║${NC}"
echo -e "${GREEN}║  ✏️  Studio:         http://$LMS_HOST:$CMS_PORT          ║${NC}"
echo -e "${GREEN}║  🔧 Admin panel:    http://$LMS_HOST:$LMS_PORT/admin    ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  👤 Admin login:    $ADMIN_USER                         ║${NC}"
echo -e "${GREEN}║  🔑 Password:       $ADMIN_PASS                         ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  📚 Courses:                                             ║${NC}"
echo -e "${GREEN}║    • Physical AI Foundations (PAI101)                   ║${NC}"
echo -e "${GREEN}║    • TeleOp Controller Certification (CTRL101)          ║${NC}"
echo -e "${GREEN}║    • TeleOp Trainer Certification (TRNR101)             ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
