#!/bin/bash
# Mars Ed — Full Automated Setup
# Installs Tutor, configures Mars Ed branding, creates admin user,
# builds OLX course packages, and imports all 3 courses.
# Run once on a fresh server.

set -e

ADMIN_USER="${MARS_ADMIN_USER:-marsed-admin}"
ADMIN_EMAIL="${MARS_ADMIN_EMAIL:-admin@marsgeo.io}"
ADMIN_PASS="${MARS_ADMIN_PASS:-MarsEd2025!}"
LMS_HOST="${MARS_LMS_HOST:-local.edly.io}"
CMS_HOST="${MARS_CMS_HOST:-studio.local.edly.io}"
PLATFORM_NAME="Mars Ed — MarsGeo Robotics University"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LMS_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Mars Ed — MarsGeo Robotics University                 ║"
echo "║   Automated LMS Setup                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Admin user:  $ADMIN_USER"
echo "  Admin email: $ADMIN_EMAIL"
echo "  LMS host:    $LMS_HOST"
echo ""

# ── Step 1: Install Tutor ──────────────────────────────────────────────────
echo "▶ Step 1/6: Installing Tutor..."
pip install --quiet --user "tutor[full]"
export PATH="$HOME/.local/bin:$PATH"

if ! command -v tutor &> /dev/null; then
  echo "❌ Tutor not found in PATH. Try: export PATH=\$HOME/.local/bin:\$PATH"
  exit 1
fi
echo "  ✅ Tutor $(tutor --version 2>/dev/null | head -1)"

# ── Step 2: Configure Mars Ed ──────────────────────────────────────────────
echo ""
echo "▶ Step 2/6: Configuring Mars Ed branding..."

tutor config save \
  --set PLATFORM_NAME="$PLATFORM_NAME" \
  --set LMS_HOST="$LMS_HOST" \
  --set CMS_HOST="$CMS_HOST" \
  --set CONTACT_EMAIL="$ADMIN_EMAIL" \
  --set ENABLE_HTTPS=false

echo "  ✅ Configuration saved"

# ── Step 3: Launch Open edX ────────────────────────────────────────────────
echo ""
echo "▶ Step 3/6: Launching Open edX (first run takes 10-15 min)..."
tutor local launch --non-interactive
echo "  ✅ Open edX is running"

# ── Step 4: Create admin user ─────────────────────────────────────────────
echo ""
echo "▶ Step 4/6: Creating admin user..."

tutor local do createuser \
  --staff \
  --superuser \
  "$ADMIN_USER" \
  "$ADMIN_EMAIL" \
  --password "$ADMIN_PASS" 2>/dev/null || \
tutor local run lms ./manage.py lms changepassword "$ADMIN_USER" <<< "$ADMIN_PASS
$ADMIN_PASS" 2>/dev/null || true

echo "  ✅ Admin user: $ADMIN_USER / $ADMIN_PASS"

# ── Step 5: Build OLX packages ────────────────────────────────────────────
echo ""
echo "▶ Step 5/6: Building OLX course packages..."

bash "$SCRIPT_DIR/build-olx-packages.sh"

echo "  ✅ OLX packages built"

# ── Step 6: Import courses ────────────────────────────────────────────────
echo ""
echo "▶ Step 6/6: Importing courses into Open edX..."

for course_zip in "$LMS_DIR/dist/"*.tar.gz; do
  course_name=$(basename "$course_zip" .tar.gz)
  echo "  Importing: $course_name..."
  tutor local do importcourse "$course_zip"
  echo "  ✅ $course_name imported"
done

# ── Apply Indigo theme ─────────────────────────────────────────────────────
echo ""
echo "▶ Applying Indigo theme..."
tutor local do settheme indigo 2>/dev/null || echo "  (theme will apply on next restart)"
tutor local restart

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ✅ Mars Ed is ready!                                  ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  LMS (learner):  http://$LMS_HOST"
echo "║  Studio:         http://$CMS_HOST"
echo "║  Django admin:   http://$LMS_HOST/admin"
echo "║                                                          ║"
echo "║  Admin login:    $ADMIN_USER"
echo "║  Admin password: $ADMIN_PASS"
echo "║                                                          ║"
echo "║  3 courses imported:                                     ║"
echo "║    • Physical AI Foundations (PAI101)                   ║"
echo "║    • TeleOp Controller Certification (CTRL101)          ║"
echo "║    • TeleOp Trainer Certification (TRNR101)             ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
