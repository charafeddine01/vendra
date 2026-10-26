<?php
declare(strict_types=1);

/**
 * Vendra Portal Local Dev Server Router
 * Simulates Apache / LiteSpeed .htaccess for `php -S 0.0.0.0:8001 router.php`
 */

$rawUri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = urldecode((string)parse_url($rawUri, PHP_URL_PATH));

function serveStatic(string $filePath): void {
    if (!is_file($filePath)) return;
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimes = [
        'js'   => 'application/javascript; charset=UTF-8',
        'css'  => 'text/css; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'html' => 'text/html; charset=UTF-8',
        'sql'  => 'text/plain',
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: {$mime}");
    header("Access-Control-Allow-Origin: *");
    readfile($filePath);
    exit;
}

// 1. Central License API
if (str_starts_with($uri, '/license-api')) {
    require __DIR__ . '/license-api/index.php';
    exit;
}

// 2. Installer
if (str_starts_with($uri, '/install')) {
    require __DIR__ . '/install/index.php';
    exit;
}

// 3. Static files
$target = __DIR__ . $uri;
if ($uri !== '/' && is_file($target)) {
    serveStatic($target);
}

// 4. Default: Showcase index.html
serveStatic(__DIR__ . '/index.html');
