#!/usr/bin/env bash
set -e

echo "=== Vendra Commercial Platform: Building Production Assets ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Compile POS Frontend if node/npm is available
if command -v npm >/dev/null 2>&1; then
    echo "-> Compiling Vendra POS Web App with Vite..."
    npm run build || true
fi

# 2. Setup internal public_html structure
mkdir -p public_html/app
mkdir -p public_html/api
mkdir -p public_html/database
mkdir -p public_html/config
mkdir -p public_html/license-api
mkdir -p public_html/uploads
mkdir -p public_html/install

# Showcase Landing Page & Root files
cp -f index.html public_html/
cp -f index.php public_html/
cp -f .htaccess public_html/
cp -f vendra.ico public_html/favicon.ico 2>/dev/null || true

# POS Application (compiled into app/ and assets/)
if [ -d "dist" ]; then
    cp -f dist/app.html public_html/app/index.html 2>/dev/null || true
    if [ -d "dist/assets" ]; then
        mkdir -p public_html/app/assets public_html/assets
        cp -rf dist/assets/* public_html/app/assets/ 2>/dev/null || true
        cp -rf dist/assets/* public_html/assets/ 2>/dev/null || true
    fi
fi

# POS Backend API
cp -rf api/* public_html/api/ 2>/dev/null || true

# Databases & Seeders
cp -rf database/* public_html/database/ 2>/dev/null || true

# Config, Licensing, Uploads
cp -rf config/* public_html/config/ 2>/dev/null || true
cp -rf license-api/* public_html/license-api/ 2>/dev/null || true
cp -rf install/* public_html/install/ 2>/dev/null || true
cp -rf uploads/* public_html/uploads/ 2>/dev/null || true

# 3. Enhance Server Auto-Sync (handles deploy clones into website root)
CANDIDATE_ROOTS=("../.." ".." ".")
for ROOT in "${CANDIDATE_ROOTS[@]}"; do
    ABS_ROOT="$(cd "$ROOT" 2>/dev/null && pwd || true)"
    if [ -n "$ABS_ROOT" ] && { [ -d "$ABS_ROOT/deploys" ] || [ -d "$ABS_ROOT/public_html.bak" ] || [ -f "$ABS_ROOT/.my.cnf" ]; }; then
        echo "Found Enhance website root at: $ABS_ROOT"
        
        mkdir -p "$ABS_ROOT/public_html/app/assets"
        mkdir -p "$ABS_ROOT/public_html/assets"
        mkdir -p "$ABS_ROOT/public_html/api"
        mkdir -p "$ABS_ROOT/public_html/database"
        mkdir -p "$ABS_ROOT/public_html/license-api"
        mkdir -p "$ABS_ROOT/public_html/uploads"
        
        cp -rf public_html/* "$ABS_ROOT/public_html/"
        chmod -R 755 "$ABS_ROOT/public_html" 2>/dev/null || true
        break
    fi
done

echo "Vendra Platform build completed successfully."
exit 0
