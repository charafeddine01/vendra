<?php
declare(strict_types=1);

/**
 * Vendra Universal Local Dev & Production Router
 * Simulates Apache / LiteSpeed .htaccess for:
 * 1. /                     -> Showcase Landing Page
 * 2. /license-api          -> Central Vendor Licensing Authority
 * 3. /api                  -> Universal POS API (Multi-Tenant Aware)
 * 4. /<customer_name>      -> Live Showroom Demo for Customers (e.g. /al-shams, /solar, /demo)
 */

$rawUri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = urldecode((string)parse_url($rawUri, PHP_URL_PATH));

function serveStatic(string $filePath): void {
    if (!is_file($filePath)) return;
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimes = [
        'js'    => 'application/javascript; charset=UTF-8',
        'mjs'   => 'application/javascript; charset=UTF-8',
        'css'   => 'text/css; charset=UTF-8',
        'json'  => 'application/json; charset=UTF-8',
        'svg'   => 'image/svg+xml',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'webp'  => 'image/webp',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'html'  => 'text/html; charset=UTF-8',
        'txt'   => 'text/plain; charset=UTF-8',
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: {$mime}");
    header("Access-Control-Allow-Origin: *");
    readfile($filePath);
    exit;
}

// 1. Central Vendor Licensing API
if (str_starts_with($uri, '/license-api')) {
    require __DIR__ . '/license-api/index.php';
    exit;
}

// 2. Universal POS Client Backend API
if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    exit;
}

// 3. Web Installer
if (str_starts_with($uri, '/install')) {
    require __DIR__ . '/install/index.php';
    exit;
}

// 4. Static Assets from dist/assets or public_html/app/assets
if (str_starts_with($uri, '/assets/')) {
    $assetPath = __DIR__ . '/dist' . $uri;
    if (is_file($assetPath)) serveStatic($assetPath);

    $appAssetPath = __DIR__ . '/public_html/app' . $uri;
    if (is_file($appAssetPath)) serveStatic($appAssetPath);
}

// 5. Uploads
if (str_starts_with($uri, '/uploads/')) {
    $uploadPath = __DIR__ . $uri;
    if (is_file($uploadPath)) serveStatic($uploadPath);
}

// 6. Direct root static files
$directFile = __DIR__ . '/public_html' . $uri;
if ($uri !== '/' && is_file($directFile) && !str_ends_with($uri, '.php')) {
    serveStatic($directFile);
}

$rootFile = __DIR__ . $uri;
if ($uri !== '/' && is_file($rootFile) && !str_ends_with($uri, '.php') && !str_starts_with($uri, '/database') && !str_starts_with($uri, '/config')) {
    serveStatic($rootFile);
}

// 7. Commercial Showcase Landing Page or Standalone POS
if ($uri === '/' || $uri === '') {
    // If standalone desktop POS (has dist/index.html without a root index.html)
    if (!file_exists(__DIR__ . '/index.html') && file_exists(__DIR__ . '/dist/index.html')) {
        serveStatic(__DIR__ . '/dist/index.html');
    }
    $showcase = file_exists(__DIR__ . '/public_html/index.html') ? __DIR__ . '/public_html/index.html' : __DIR__ . '/index.html';
    if (file_exists($showcase)) {
        serveStatic($showcase);
    }
}

// 8. Multi-Tenant Customer Live Demo:
// Any slug like /al-shams, /solar, /demo, /solar-tech serves the POS application
$appHtml = file_exists(__DIR__ . '/public_html/app/index.html') 
    ? __DIR__ . '/public_html/app/index.html' 
    : (file_exists(__DIR__ . '/dist/app.html') ? __DIR__ . '/dist/app.html' : __DIR__ . '/app.html');

if (file_exists($appHtml)) {
    serveStatic($appHtml);
}

// Fallback to showcase landing page
serveStatic(__DIR__ . '/index.html');
