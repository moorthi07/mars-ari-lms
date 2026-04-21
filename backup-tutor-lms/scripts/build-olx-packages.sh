#!/bin/bash
# Builds OLX tar.gz packages for all 3 courses
# Open edX imports courses from OLX format (tar.gz of course directory)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LMS_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$LMS_DIR/dist"
OLX_DIR="$LMS_DIR/olx"

mkdir -p "$DIST_DIR"
mkdir -p "$OLX_DIR"

echo "  Building OLX packages..."

# Build each course
for course in course1-physical-ai-foundations course2-teleop-controller course3-teleop-trainer; do
  echo "    Building $course..."
  python3 "$SCRIPT_DIR/generate-olx.py" "$course" "$OLX_DIR" "$LMS_DIR/courses/$course"
  
  # Package as tar.gz
  cd "$OLX_DIR"
  tar -czf "$DIST_DIR/$course.tar.gz" "$course/"
  echo "    ✅ $DIST_DIR/$course.tar.gz"
done

echo "  All packages built in $DIST_DIR/"
