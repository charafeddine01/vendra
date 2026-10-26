#!/usr/bin/env bash
set -e

echo "=== Vendra Portal: Preparing Production Assets ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Ensure internal public_html is always up to date
mkdir -p public_html
cp -f index.html public_html/
cp -f index.php public_html/
cp -f .htaccess public_html/
cp -rf config public_html/
cp -rf database public_html/
cp -rf install public_html/
cp -rf license-api public_html/
cp -rf uploads public_html/

# 2. Mirror to public/ and dist/ in case platform expects them
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

# 3. Server deployment detection: if parent has public_html or public_html.bak, sync directly into it
if [ -d "../public_html" ] || [ -d "../public_html.bak" ]; then
    PARENT_PUB="../public_html"
    echo "Syncing assets into ${PARENT_PUB}..."
    mkdir -p "$PARENT_PUB"
    cp -f index.html "$PARENT_PUB/" 2>/dev/null || true
    cp -f index.php "$PARENT_PUB/" 2>/dev/null || true
    cp -f .htaccess "$PARENT_PUB/" 2>/dev/null || true
    cp -rf config "$PARENT_PUB/" 2>/dev/null || true
    cp -rf database "$PARENT_PUB/" 2>/dev/null || true
    cp -rf install "$PARENT_PUB/" 2>/dev/null || true
    cp -rf license-api "$PARENT_PUB/" 2>/dev/null || true
    cp -rf uploads "$PARENT_PUB/" 2>/dev/null || true
fi

echo "Vendra Portal: Pure PHP 8.2+ & Static HTML ready in root and public_html/."
echo "Build succeeded."
exit 0
