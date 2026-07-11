#!/usr/bin/env bash
set -euo pipefail

# Build source package for PPA upload
# Run from project root: bash scripts/build-ppa.sh

echo "=== Building PPA source package ==="

# Install required tools
sudo apt-get update
sudo apt-get install -y devscripts debhelper dh-make

# Build source package (no binary, Launchpad builds it)
debuild -S -sa -k

echo ""
echo "=== Source package built ==="
echo "Files created in parent directory:"
ls -la ../*.dsc ../*.tar.* ../*.changes ../*.source.changes 2>/dev/null || true

echo ""
echo "To upload to PPA:"
echo "  dput ppa:kapsdd/chrono ../chronotasks_3.3.0-1_source.changes"
