#!/usr/bin/env bash
set -e

# Vendra Production Deployment Script
# Merges current 'main' branch into 'production' and pushes to GitHub to trigger cPanel auto-deploy.

cd "$(dirname "${BASH_SOURCE[0]}")"

# 1. Server-side CI / Enhance deploy detection:
# If running in server deployment container / detached HEAD / deploys directory, exit cleanly
if [ -z "$(git branch --list main 2>/dev/null)" ] || [ -n "$CI" ] || [[ "$PWD" == *"/deploys/"* ]] || [ ! -d ".git" ]; then
    echo "=== Server Deployment Environment Detected ==="
    echo "Vendra Portal requires no compilation. Pure PHP 8.2+ & Static HTML ready."
    echo "Build succeeded."
    exit 0
fi

echo "=== 1. Checking Status on main branch ==="
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Switching to main branch..."
    git checkout main
fi

# Ensure all local changes on main are committed
if ! git diff-index --quiet HEAD --; then
    echo "Error: You have uncommitted changes on main. Please commit them first."
    exit 1
fi

echo "=== 2. Pushing latest changes to origin/main ==="
git push origin main

echo "=== 3. Merging main into production branch ==="
git checkout production
git pull origin production --ff-only || true
git merge main -m "chore(release): deploy main to production"

echo "=== 4. Pushing to origin/production (triggers hosting.com auto-deploy) ==="
git push origin production

echo "=== 5. Returning to main branch for active coding ==="
git checkout main

echo ""
echo "================================================================"
echo "  SUCCESS: 'production' branch updated on GitHub!"
echo "  hosting.com auto-deploy is now updating vendra.charafeddine.xyz"
echo "================================================================"
