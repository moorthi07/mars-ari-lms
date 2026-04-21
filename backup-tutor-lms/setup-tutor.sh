#!/bin/bash
# Mars Ed — Tutor Open edX Setup Script
# Run this on your server to install and configure the LMS

set -e

echo "🚀 Mars Ed — Setting up Tutor Open edX LMS"
echo "============================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Don't run as root. Run as your normal user."
  exit 1
fi

# Install Tutor
echo "📦 Installing Tutor..."
pip install --user "tutor[full]"

# Add to PATH if not already there
export PATH="$HOME/.local/bin:$PATH"

# Verify installation
if ! command -v tutor &> /dev/null; then
  echo "❌ Tutor installation failed. Check pip install output above."
  exit 1
fi

echo "✅ Tutor installed successfully"
echo ""

# Configure Tutor for Mars Ed
echo "⚙️  Configuring Mars Ed branding..."

tutor config save \
  --set PLATFORM_NAME="Mars Ed — MarsGeo Robotics University" \
  --set CONTACT_EMAIL="learn@marsgeo.io" \
  --set LMS_HOST="learn.marsgeo.io" \
  --set CMS_HOST="studio.marsgeo.io"

echo "✅ Configuration saved"
echo ""

# Launch (this will take 10-15 minutes on first run)
echo "🚢 Launching Open edX (this takes 10-15 minutes on first run)..."
echo "   You'll be prompted to set admin credentials."
echo ""

tutor local launch

echo ""
echo "✅ Mars Ed LMS is running!"
echo ""
echo "📍 Access URLs:"
echo "   LMS (learner view):  http://learn.marsgeo.io (or http://localhost:8000)"
echo "   Studio (authoring):  http://studio.marsgeo.io (or http://localhost:8001)"
echo ""
echo "🔐 Admin credentials: (you set these during launch)"
echo ""
echo "📚 Next steps:"
echo "   1. Log into Studio at http://studio.marsgeo.io"
echo "   2. Run: bash lms/scripts/import-courses.sh"
echo "   3. Courses will appear in the LMS"
echo ""
