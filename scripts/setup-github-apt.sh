#!/usr/bin/env bash
set -euo pipefail

# Complete workflow: build .deb, create APT repo, push to GitHub Pages
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - GPG key for signing (optional but recommended)
#   - Run from project root
#
# Usage: bash scripts/setup-github-apt.sh [github-user/repo]

REPO="${1:-}"
REPO_DIR="apt-repo"
BRANCH="apt-repo"

if [ -z "$REPO" ]; then
  # Try to detect from git remote
  REPO=$(git remote get-url origin 2>/dev/null | sed -E 's|.*github\.com[:/](.+)\.git|\1|' || true)
fi

if [ -z "$REPO" ]; then
  echo "Usage: bash scripts/setup-github-apt.sh <github-user/chrono>"
  echo "Example: bash scripts/setup-github-apt.sh aers/chrono"
  exit 1
fi

echo "=== Setting up APT repository for $REPO ==="

# Step 1: Build if needed
if [ ! -f "$REPO_DIR/dists/stable/main/binary-amd64/Packages" ]; then
  echo "Building packages..."
  bash scripts/build-linux.sh
  bash scripts/create-apt-repo.sh
fi

# Step 2: Generate GPG key if needed (for signing)
if ! gpg --list-keys "chrono@example.com" >/dev/null 2>&1; then
  echo ""
  echo "No GPG key found for signing."
  echo "You can either:"
  echo "  1. Generate a key: gpg --full-generate-key (use email: chrono@example.com)"
  echo "  2. Skip signing (users will need --allow-unauthenticated)"
  echo ""
  read -p "Generate GPG key now? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gpg --full-generate-key
  fi
fi

# Export public key
if gpg --list-keys "chrono@example.com" >/dev/null 2>&1; then
  gpg --export "chrono@example.com" > "$REPO_DIR/KEY.gpg"
  echo "Exported GPG public key to $REPO_DIR/KEY.gpg"
fi

# Step 3: Create orphan branch and push
echo ""
echo "Pushing APT repository to GitHub Pages..."

# Initialize git repo in apt-repo dir
cd "$REPO_DIR"
git init
git checkout --orphan "$BRANCH"
git add -A
git commit -m "APT repository for CHRONO"

# Add remote and push
git remote add origin "https://github.com/$REPO.git"
git push -f origin "$BRANCH"

cd ..

echo ""
echo "=== Done ==="
echo ""
echo "Enable GitHub Pages in repo settings:"
echo "  Source: Deploy from a branch"
echo "  Branch: $BRANCH / / (root)"
echo ""
echo "Users install with:"
echo "  # Add the repository"
echo "  sudo mkdir -p /etc/apt/keyrings"
echo "  wget -qO- https://$(echo $REPO | cut -d/ -f1).github.io/$(echo $REPO | cut -d/ -f2)/KEY.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/chrono.gpg"
echo "  echo 'deb [signed-by=/etc/apt/keyrings/chrono.gpg] https://$(echo $REPO | cut -d/ -f1).github.io/$(echo $REPO | cut -d/ -f2) stable main' | sudo tee /etc/apt/sources.list.d/chrono.list"
echo ""
echo "  # Install"
echo "  sudo apt update"
echo "  sudo apt install chronotasks"
