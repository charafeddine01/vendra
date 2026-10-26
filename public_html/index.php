<?php
declare(strict_types=1);

/**
 * Vendra Portal - Master Entrypoint & Router
 * Ensures instant loading on LiteSpeed, Apache, and Nginx
 */

$rawUri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = (string)parse_url($rawUri, PHP_URL_PATH);

// 1. Central License API endpoint routing
if (str_starts_with($uri, '/license-api')) {
    require __DIR__ . '/license-api/index.php';
    exit;
}

// 2. 1-Click Web Installer routing
if (str_starts_with($uri, '/install')) {
    require __DIR__ . '/install/index.php';
    exit;
}

// 3. Static File Fallback
$staticFile = __DIR__ . $uri;
if ($uri !== '/' && is_file($staticFile)) {
    $ext = strtolower(pathinfo($staticFile, PATHINFO_EXTENSION));
    $mimes = [
        'js'   => 'application/javascript; charset=UTF-8',
        'css'  => 'text/css; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'ico'  => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2'=> 'font/woff2',
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: {$mime}");
    header("Access-Control-Allow-Origin: *");
    readfile($staticFile);
    exit;
}

// 4. Default: Serve Showcase index.html
$indexFile = __DIR__ . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexFile);
    exit;
}

echo "Vendra Portal operational. index.html not found.";
