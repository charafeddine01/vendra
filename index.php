<?php
declare(strict_types=1);

/**
 * Vendra Universal Master Entrypoint & Router
 * Ensures 100% reliability on LiteSpeed, Apache, and Nginx
 */

$rawUri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = (string)parse_url($rawUri, PHP_URL_PATH);

// 1. Central License API
if (str_starts_with($uri, '/license-api')) {
    require __DIR__ . '/license-api/index.php';
    exit;
}

// 2. POS Client Backend API
if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    exit;
}

// 3. 1-Click Web Installer
if (str_starts_with($uri, '/install')) {
    require __DIR__ . '/install/index.php';
    exit;
}

// 4. Direct POS Web Application (/app)
if (str_starts_with($uri, '/app')) {
    $appFile = __DIR__ . '/app/index.html';
    if (file_exists($appFile)) {
        header('Content-Type: text/html; charset=UTF-8');
        readfile($appFile);
        exit;
    }
}

// 5. Customer Live Test Routing (e.g. /al-shams, /solar, /demo, /solar-tech)
$slug = trim($uri, '/');
if (!empty($slug) && preg_match('/^[a-zA-Z0-9_-]+$/', $slug)) {
    header("Location: /app/?tenant=" . urlencode($slug), true, 302);
    exit;
}

// 6. Static File Fallback
$staticFile = __DIR__ . $uri;
if ($uri !== '/' && is_file($staticFile)) {
    $ext = strtolower(pathinfo($staticFile, PATHINFO_EXTENSION));
    $mimes = [
        'js'    => 'application/javascript; charset=UTF-8',
        'css'   => 'text/css; charset=UTF-8',
        'json'  => 'application/json; charset=UTF-8',
        'svg'   => 'image/svg+xml',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: {$mime}");
    header("Access-Control-Allow-Origin: *");
    readfile($staticFile);
    exit;
}

// 7. Commercial Showcase Landing Page (Root /)
$indexFile = __DIR__ . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexFile);
    exit;
}

echo "Vendra Platform operational.";
