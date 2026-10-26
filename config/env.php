<?php
declare(strict_types=1);

/**
 * Vendra Production Configuration - hosting.com cPanel
 * Domain: vendra.charafeddine.xyz
 */

return [
    'db' => [
        'driver'    => 'mysql',
        'host'      => 'localhost',
        'port'      => 3306,
        'database'  => 'vendra_c1_vendra',
        'username'  => 'vendra_c1_vendra',
        'password'  => 'Paviliondm4?',
        'charset'   => 'utf8mb4',
    ],
    'security_salt'         => 'c3b290df6f157adbc4ae8b7593c6603a118844f2ef69389274291882ea7cba51',
    'jwt_secret'            => '8812f9136ca7026dfbe5c39121a50a80e461b244799011de873b22415e7cba51',
    'admin_password'        => 'Paviliondm4?',
    'admin_password_hash'   => '$2y$12$V5UPI4B19fNt9sLIJd1z8uNNSiDhHrF/0tJ9qb7zLraqXue65VAzi',
    'admin_email'           => 'charafeddine@vendra.charafeddine.xyz',
    'vendor_public_key_hex' => '7cba51469668791a660ee64c5815922b0349dc4e74ae39e2cc9c5d232dacbcf4',
    'vendor_secret_key_hex' => 'b3106c9011e167d15a84ae3f12857256be7d4efc357cedfbb7d0604bb322415e7cba51469668791a660ee64c5815922b0349dc4e74ae39e2cc9c5d232dacbcf4',
    'installed_at'          => 1793050000,
];
