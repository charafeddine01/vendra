#!/usr/bin/env bash
set -e

echo "=== Vendra Portal: Preparing Production Assets ==="

# 1. Mirror all portal files into public/ and dist/
# This guarantees that whichever Publish Directory Enhance is set to (Root, public, or dist), LiteSpeed finds the files.
for TARGET in public dist; do
    mkdir -p "$TARGET"
    cp -f index.html "$TARGET/"
    cp -f .htaccess "$TARGET/"
    cp -rf config "$TARGET/"
    cp -rf database "$TARGET/"
    cp -rf install "$TARGET/"
    cp -rf license-api "$TARGET/"
    cp -rf uploads "$TARGET/"
done

echo "Vendra Portal: Pure PHP 8.2+ & Static HTML ready in root, public/, and dist/."
echo "Build succeeded."
exit 0
