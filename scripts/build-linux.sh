#!/usr/bin/env bash
set -euo pipefail

# Build CHRONO for Linux (deb + AppImage)
# Run from project root: bash scripts/build-linux.sh

echo "=== Building CHRONO for Linux ==="

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build Next.js static export
echo "Building Next.js..."
npm run build

# Build Linux packages
echo "Building Linux packages..."
npx electron-builder --linux deb AppImage

echo ""
echo "=== Build complete ==="
echo "Packages are in the release/ directory:"
ls -lh release/*.deb release/*.AppImage 2>/dev/null || echo "No packages found"
