#!/usr/bin/env bash
set -euo pipefail

# Create a self-hosted APT repository from built .deb files
# This creates a structure suitable for GitHub Pages hosting
#
# Usage: bash scripts/create-apt-repo.sh [deb-file]
# If no deb-file is specified, uses the latest from release/

REPO_DIR="apt-repo"
DIST="stable"
COMPONENT="main"
ARCH="amd64"

# Find the .deb file
if [ $# -ge 1 ]; then
  DEB_FILE="$1"
else
  DEB_FILE=$(ls -t release/*.deb 2>/dev/null | head -1)
fi

if [ -z "$DEB_FILE" ] || [ ! -f "$DEB_FILE" ]; then
  echo "Error: No .deb file found. Build first with: bash scripts/build-linux.sh"
  exit 1
fi

echo "Creating APT repository from: $DEB_FILE"

# Create repo structure
mkdir -p "$REPO_DIR/pool/main"
mkdir -p "$REPO_DIR/dists/$DIST/$COMPONENT/binary-$ARCH"

# Copy deb to pool
cp "$DEB_FILE" "$REPO_DIR/pool/main/"

# Generate Packages file
cd "$REPO_DIR"
dpkg-scanpackages --multiversion pool/ /dev/null > "dists/$DIST/$COMPONENT/binary-$ARCH/Packages"
gzip -k -f "dists/$DIST/$COMPONENT/binary-$ARCH/Packages"

# Generate Release file
cd "dists/$DIST"
cat > Release << EOF
Origin: CHRONO
Label: CHRONO
Suite: $DIST
Codename: $DIST
Architectures: $ARCH amd64 arm64
Components: $COMPONENT
Description: CHRONO Task Manager APT Repository
EOF

# Add checksums to Release
apt-ftparchive release . >> Release

cd ../..

echo ""
echo "=== APT repository created ==="
echo "Repository structure:"
find "$REPO_DIR" -type f | head -20
echo ""
echo "To host on GitHub Pages:"
echo "  1. Create a branch 'apt-repo' with contents of $REPO_DIR/"
echo "  2. Users add the repo with:"
echo "     echo 'deb https://<username>.github.io/chrono/apt-repo stable main' | sudo tee /etc/apt/sources.list.d/chrono.list"
echo "     wget -qO- https://<username>.github.io/chrono/apt-repo/KEY.gpg | sudo apt-key add -"
echo "     sudo apt update && sudo apt install chronotasks"
