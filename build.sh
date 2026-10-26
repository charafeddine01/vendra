#!/usr/bin/env bash
set -e

echo "=== Vendra Portal: Preparing Production Assets ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Update internal public_html
mkdir -p public_html
cp -f index.html public_html/
cp -f index.php public_html/
cp -f .htaccess public_html/
cp -f server.js public_html/ 2>/dev/null || true
cp -f package.json public_html/ 2>/dev/null || true
cp -rf config public_html/
cp -rf database public_html/
cp -rf install public_html/
cp -rf license-api public_html/
cp -rf uploads public_html/

# 2. Mirror to public/ and dist/
for TARGET in public dist; do
    mkdir -p "$TARGET"
    cp -f index.html "$TARGET/"
    cp -f index.php "$TARGET/"
    cp -f .htaccess "$TARGET/"
    cp -rf config "$TARGET/"
    cp -rf database "$TARGET/"
    cp -rf install "$TARGET/"
    cp -rf license-api "$TARGET/"
    cp -rf uploads "$TARGET/"
done

# 3. Enhance server auto-recovery:
# Find website root (typically ../.. from deploys/<hash> or current dir)
CANDIDATE_ROOTS=("../.." ".." ".")
for ROOT in "${CANDIDATE_ROOTS[@]}"; do
    ABS_ROOT="$(cd "$ROOT" 2>/dev/null && pwd || true)"
    if [ -n "$ABS_ROOT" ] && { [ -d "$ABS_ROOT/deploys" ] || [ -d "$ABS_ROOT/public_html.bak" ] || [ -f "$ABS_ROOT/.my.cnf" ]; }; then
        echo "Found Enhance website root at: $ABS_ROOT"
        
        # Restore / create public_html
        mkdir -p "$ABS_ROOT/public_html"
        cp -f index.html "$ABS_ROOT/public_html/"
        cp -f index.php "$ABS_ROOT/public_html/"
        cp -f .htaccess "$ABS_ROOT/public_html/"
        cp -rf config "$ABS_ROOT/public_html/"
        cp -rf database "$ABS_ROOT/public_html/"
        cp -rf install "$ABS_ROOT/public_html/"
        cp -rf license-api "$ABS_ROOT/public_html/"
        cp -rf uploads "$ABS_ROOT/public_html/"
        chmod 755 "$ABS_ROOT/public_html" 2>/dev/null || true
        
        # Also ensure root has entrypoints
        cp -f index.html "$ABS_ROOT/" 2>/dev/null || true
        cp -f index.php "$ABS_ROOT/" 2>/dev/null || true
        cp -f .htaccess "$ABS_ROOT/" 2>/dev/null || true
        cp -f server.js "$ABS_ROOT/" 2>/dev/null || true
        cp -f package.json "$ABS_ROOT/" 2>/dev/null || true
        break
    fi
done

echo "Vendra Portal: Pure PHP 8.2+ & Node.js dual-compatibility ready."
echo "Build succeeded."
exit 0
