#!/usr/bin/env bash
set -e

# OmniPOS / Vendra - 1-Click Windows Single-File Installer Builder (.exe)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_WIN="$ROOT_DIR/dist-windows"
APP_DIR="$DIST_WIN/VendraPOS/app"
TOOLS_DIR="$ROOT_DIR/.cache/nsis-tools"

echo "======================================================================"
echo "      Vendra Commercial POS - Single-File Windows Installer Builder   "
echo "======================================================================"

# 1. Compile fresh frontend
echo "-> 1. Compiling frontend assets..."
if command -v npm >/dev/null 2>&1; then
    npm run build
fi

# 2. Sync app files into dist-windows/VendraPOS/app
echo "-> 2. Syncing app files..."
rm -rf "$APP_DIR/dist" "$APP_DIR/api" "$APP_DIR/public"
mkdir -p "$APP_DIR"
cp -r "$ROOT_DIR/dist" "$APP_DIR/"
cp -f "$ROOT_DIR/dist/app.html" "$APP_DIR/dist/index.html" 2>/dev/null || true
cp -r "$ROOT_DIR/api" "$APP_DIR/"
cp "$ROOT_DIR/router.php" "$APP_DIR/"
mkdir -p "$APP_DIR/public/uploads"
cp -r "$ROOT_DIR/public/"* "$APP_DIR/public/" 2>/dev/null || true
cp "$DIST_WIN/VendraPOS/vendra.ico" "$APP_DIR/public/favicon.ico"
cp "$DIST_WIN/VendraPOS/vendra.ico" "$APP_DIR/dist/favicon.ico"

# Database template
mkdir -p "$APP_DIR/database"
if [ -f "$ROOT_DIR/database/omnipos-solar.sqlite" ]; then
    cp -f "$ROOT_DIR/database/omnipos-solar.sqlite" "$APP_DIR/database/omnipos.sqlite"
fi

# 3. Ensure NSIS build tools are available
echo "-> 3. Checking NSIS compiler..."
MAKENSIS_CMD="makensis"
MAKENSIS_PREFIX=""

if ! command -v makensis >/dev/null 2>&1; then
    mkdir -p "$TOOLS_DIR"
    if [ ! -f "$TOOLS_DIR/usr/bin/makensis" ]; then
        echo "   Downloading portable NSIS runtime for Linux..."
        cd "$TOOLS_DIR"
        apt-get download nsis nsis-common >/dev/null 2>&1
        dpkg -x nsis_*.deb "$TOOLS_DIR" >/dev/null 2>&1
        dpkg -x nsis-common_*.deb "$TOOLS_DIR" >/dev/null 2>&1
        rm -f *.deb
    fi

    if [ ! -f "$TOOLS_DIR/nsis-redirect.so" ]; then
        echo "   Compiling path redirector for NSIS stubs..."
        cat << 'EOF' > "$TOOLS_DIR/nsis-redirect.c"
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <sys/stat.h>

static const char PREFIX[] = "/usr/share/nsis";

static const char* get_replacement() {
    static char rep[512] = {0};
    if (rep[0] == 0) {
        const char* env_dir = getenv("NSIS_REPLACE_DIR");
        if (env_dir) strncpy(rep, env_dir, sizeof(rep)-1);
    }
    return rep;
}

static const char* redirect(const char* path, char* buf, size_t bufsize) {
    const char* rep = get_replacement();
    if (rep[0] && path && strncmp(path, PREFIX, strlen(PREFIX)) == 0) {
        snprintf(buf, bufsize, "%s%s", rep, path + strlen(PREFIX));
        return buf;
    }
    return path;
}

FILE* fopen(const char* path, const char* mode) {
    static FILE* (*real_fopen)(const char*, const char*) = NULL;
    if (!real_fopen) real_fopen = dlsym(RTLD_NEXT, "fopen");
    char buf[1024];
    return real_fopen(redirect(path, buf, sizeof(buf)), mode);
}

FILE* fopen64(const char* path, const char* mode) {
    static FILE* (*real_fopen64)(const char*, const char*) = NULL;
    if (!real_fopen64) real_fopen64 = dlsym(RTLD_NEXT, "fopen64");
    char buf[1024];
    return real_fopen64(redirect(path, buf, sizeof(buf)), mode);
}

int open(const char* path, int flags, ...) {
    static int (*real_open)(const char*, int, mode_t) = NULL;
    if (!real_open) real_open = dlsym(RTLD_NEXT, "open");
    char buf[1024];
    return real_open(redirect(path, buf, sizeof(buf)), flags, 0666);
}

int open64(const char* path, int flags, ...) {
    static int (*real_open64)(const char*, int, mode_t) = NULL;
    if (!real_open64) real_open64 = dlsym(RTLD_NEXT, "open64");
    char buf[1024];
    return real_open64(redirect(path, buf, sizeof(buf)), flags, 0666);
}

int access(const char* path, int mode) {
    static int (*real_access)(const char*, int) = NULL;
    if (!real_access) real_access = dlsym(RTLD_NEXT, "access");
    char buf[1024];
    return real_access(redirect(path, buf, sizeof(buf)), mode);
}

int stat(const char* path, struct stat* buf_stat) {
    static int (*real_stat)(const char*, struct stat*) = NULL;
    if (!real_stat) real_stat = dlsym(RTLD_NEXT, "stat");
    char buf[1024];
    return real_stat(redirect(path, buf, sizeof(buf)), buf_stat);
}

int __xstat(int ver, const char* path, struct stat* buf_stat) {
    static int (*real_xstat)(int, const char*, struct stat*) = NULL;
    if (!real_xstat) real_xstat = dlsym(RTLD_NEXT, "__xstat");
    char buf[1024];
    return real_xstat(ver, redirect(path, buf, sizeof(buf)), buf_stat);
}

int __xstat64(int ver, const char* path, void* buf_stat) {
    static int (*real_xstat64)(int, const char*, void*) = NULL;
    if (!real_xstat64) real_xstat64 = dlsym(RTLD_NEXT, "__xstat64");
    char buf[1024];
    return real_xstat64(ver, redirect(path, buf, sizeof(buf)), buf_stat);
}

void* opendir(const char* name) {
    static void* (*real_opendir)(const char*) = NULL;
    if (!real_opendir) real_opendir = dlsym(RTLD_NEXT, "opendir");
    char buf[1024];
    return real_opendir(redirect(name, buf, sizeof(buf)));
}
EOF
        gcc -shared -fPIC -o "$TOOLS_DIR/nsis-redirect.so" "$TOOLS_DIR/nsis-redirect.c" -ldl
    fi

    export NSIS_REPLACE_DIR="$TOOLS_DIR/usr/share/nsis"
    MAKENSIS_CMD="$TOOLS_DIR/usr/bin/makensis"
    MAKENSIS_PREFIX="LD_PRELOAD=$TOOLS_DIR/nsis-redirect.so"
fi

# 4. Compile Single-File Installer
echo "-> 4. Compiling VendraPOS-Setup.exe (Single-File Installer)..."
cd "$DIST_WIN"
eval $MAKENSIS_PREFIX "$MAKENSIS_CMD" installer.nsi

# 5. Copy to public_html/downloads for direct user download
mkdir -p "$ROOT_DIR/public_html/downloads"
cp -f "$DIST_WIN/VendraPOS-Setup.exe" "$ROOT_DIR/public_html/downloads/VendraPOS-Setup.exe"
cp -f "$DIST_WIN/VendraPOS-Setup.exe" "$ROOT_DIR/public_html/downloads/VendraPOS-Installer.exe"

EXE_SIZE=$(du -h "$DIST_WIN/VendraPOS-Setup.exe" | cut -f1)
echo "======================================================================"
echo " [SUCCESS] Single-file Windows installer generated: $EXE_SIZE"
echo " Location: $DIST_WIN/VendraPOS-Setup.exe"
echo " Web Download: $ROOT_DIR/public_html/downloads/VendraPOS-Setup.exe"
echo "======================================================================"
