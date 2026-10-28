<?php
declare(strict_types=1);

namespace OmniPOS\Core;

use PDO;
use PDOException;
use RuntimeException;

class Database
{
    private static ?PDO $instance = null;
    private static array $config = [];

    public static function init(array $config): void
    {
        self::$config = $config;
    }

    public static function getInstance(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $dbConfig = self::$config['db'] ?? [
            'driver' => 'sqlite',
            'database' => __DIR__ . '/../../database/omnipos.sqlite'
        ];

        // Multi-Tenant Showroom & Live Demo Resolver
        $tenant = self::resolveTenant();
        if (!empty($tenant) && ($dbConfig['driver'] ?? 'sqlite') === 'sqlite') {
            $baseDir = dirname($dbConfig['database']);
            $tenantsDir = $baseDir . '/tenants';
            if (!is_dir($tenantsDir)) {
                mkdir($tenantsDir, 0755, true);
            }
            $cleanTenant = preg_replace('/[^a-zA-Z0-9_-]/', '', strtolower($tenant));

            $solarAliases = ['solar', 'al-shams', 'alshams', 'solar-tech', 'al-shams-solar'];
            if (in_array($cleanTenant, $solarAliases, true)) {
                $solarDb = $baseDir . '/omnipos-solar.sqlite';
                if (file_exists($solarDb)) {
                    $dbConfig['database'] = $solarDb;
                }
            } else {
                $tenantDb = $tenantsDir . '/' . $cleanTenant . '.sqlite';
                if (!file_exists($tenantDb)) {
                    $baseDb = $baseDir . '/omnipos-solar.sqlite';
                    if (!file_exists($baseDb)) {
                        $baseDb = $baseDir . '/omnipos.sqlite';
                    }
                    if (file_exists($baseDb)) {
                        copy($baseDb, $tenantDb);
                        try {
                            $tPdo = new PDO("sqlite:{$tenantDb}");
                            $formattedName = ucwords(str_replace(['-', '_'], ' ', $cleanTenant));
                            $tPdo->prepare("UPDATE company_settings SET company_name = :cn WHERE id = 1")->execute([
                                ':cn' => $formattedName . ' Showroom'
                            ]);
                        } catch (\Throwable $t) {}
                    }
                }
                if (file_exists($tenantDb)) {
                    $dbConfig['database'] = $tenantDb;
                }
            }
        }

        try {
            if (($dbConfig['driver'] ?? 'mysql') === 'sqlite') {
                $dbPath = $dbConfig['database'];
                $dbDir = dirname($dbPath);
                if (!is_dir($dbDir)) {
                    mkdir($dbDir, 0755, true);
                }
                $isNewDb = !file_exists($dbPath) || filesize($dbPath) === 0;

                $dsn = "sqlite:{$dbPath}";
                $pdo = new PDO($dsn, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);
                $pdo->exec('PRAGMA foreign_keys = ON;');
                self::$instance = $pdo;

                if ($isNewDb) {
                    self::initializeSqliteDatabase($pdo);
                } else {
                    self::ensureSchemaMigrations($pdo);
                }
            } else {
                // MySQL / MariaDB for production shared hosting
                $dsn = sprintf(
                    'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                    $dbConfig['host'],
                    $dbConfig['port'],
                    $dbConfig['database'],
                    $dbConfig['charset'] ?? 'utf8mb4'
                );

                $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);

                self::$instance = $pdo;
            }

            return self::$instance;
        } catch (PDOException $e) {
            // If MySQL failed and driver was mysql, we can log and fail gracefully
            throw new RuntimeException("Database connection failure: " . $e->getMessage(), (int)$e->getCode(), $e);
        }
    }

    private static function initializeSqliteDatabase(PDO $pdo): void
    {
        $schemaFile = __DIR__ . '/../../database/schema.sql';
        $seedFile = __DIR__ . '/../../database/seed.sql';

        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            $sql = preg_replace('/ENGINE=\w+ DEFAULT CHARSET=\w+ COLLATE=[\w_]+/i', '', $sql);
            $sql = preg_replace('/SET FOREIGN_KEY_CHECKS\s*=\s*[01];/i', '', $sql);
            $sql = preg_replace('/INT UNSIGNED AUTO_INCREMENT PRIMARY KEY/i', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
            $sql = preg_replace('/AUTO_INCREMENT/i', '', $sql);
            $sql = preg_replace('/INT UNSIGNED/i', 'INTEGER', $sql);
            $sql = preg_replace('/BIGINT UNSIGNED/i', 'INTEGER', $sql);
            $sql = preg_replace('/TINYINT\(1\)/i', 'INTEGER', $sql);
            $sql = preg_replace('/MEDIUMTEXT/i', 'TEXT', $sql);
            $sql = preg_replace('/ENUM\([^)]+\)/i', 'TEXT', $sql);
            $sql = preg_replace('/JSON/i', 'TEXT', $sql);
            $sql = preg_replace('/ON UPDATE CURRENT_TIMESTAMP/i', '', $sql);
            $sql = preg_replace('/COMMENT\s+\'[^\']*\'/i', '', $sql);
            $sql = preg_replace('/,\s*INDEX\s+`[^`]+`\s*\([^)]+\)/i', '', $sql);
            $sql = preg_replace('/,\s*UNIQUE\s+KEY\s+`[^`]+`\s*\([^)]+\)/i', '', $sql);

            $statements = array_filter(array_map('trim', explode(';', $sql)));
            foreach ($statements as $stmt) {
                if (!empty($stmt)) {
                    try {
                        $pdo->exec($stmt);
                    } catch (\Throwable $t) {
                        // Ignore individual index parse warnings
                    }
                }
            }
        }

        if (file_exists($seedFile)) {
            $seedSql = file_get_contents($seedFile);
            $seedSql = preg_replace('/SET FOREIGN_KEY_CHECKS\s*=\s*[01];/i', '', $seedSql);
            $seedSql = preg_replace('/ON DUPLICATE KEY UPDATE[^;]+/i', '', $seedSql);

            $statements = array_filter(array_map('trim', explode(';', $seedSql)));
            foreach ($statements as $stmt) {
                if (!empty($stmt)) {
                    try {
                        $pdo->exec($stmt);
                    } catch (\Throwable $t) {
                        // Ignore duplicate key warnings on seed
                    }
                }
            }
        }
    }

    private static function ensureSchemaMigrations(PDO $pdo): void
    {
        try {
            $pdo->exec("
            CREATE TABLE IF NOT EXISTS `installment_plans` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                `order_id` INTEGER NOT NULL,
                `customer_id` INTEGER NOT NULL,
                `plan_number` VARCHAR(64) NOT NULL UNIQUE,
                `total_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `down_payment` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `remaining_balance` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `total_installments` INTEGER NOT NULL DEFAULT 1,
                `installment_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `frequency` VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
                `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
                `notes` TEXT NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS `installment_schedule` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                `plan_id` INTEGER NOT NULL,
                `installment_number` INTEGER NOT NULL,
                `due_date` DATE NOT NULL,
                `amount_due` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `amount_paid` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `remaining_amount` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                `notes` TEXT NULL,
                `paid_at` TIMESTAMP NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS `installment_payments` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                `schedule_id` INTEGER NOT NULL,
                `plan_id` INTEGER NOT NULL,
                `customer_id` INTEGER NOT NULL,
                `receipt_number` VARCHAR(64) NOT NULL UNIQUE,
                `amount_paid` DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
                `exchange_rate` DECIMAL(15,4) NOT NULL DEFAULT 1.0000,
                `payment_method` VARCHAR(32) NOT NULL DEFAULT 'CASH',
                `cashier_id` INTEGER NOT NULL,
                `notes` TEXT NULL,
                `payment_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ");
        } catch (\Throwable $e) {
            // Ignore if already created
        }
    }

    public static function resolveTenant(): string
    {
        if (!empty($_SERVER['HTTP_X_TENANT'])) {
            return trim($_SERVER['HTTP_X_TENANT']);
        }
        if (!empty($_GET['tenant'])) {
            return trim($_GET['tenant']);
        }
        if (!empty($_SERVER['HTTP_REFERER'])) {
            $path = parse_url($_SERVER['HTTP_REFERER'], PHP_URL_PATH);
            $parts = array_values(array_filter(explode('/', (string)$path)));
            if (!empty($parts[0]) && !in_array($parts[0], ['api', 'license-api', 'install', 'dist', 'assets', 'uploads'], true)) {
                return $parts[0];
            }
        }
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        $parts = array_values(array_filter(explode('/', (string)$uri)));
        if (!empty($parts[0]) && !in_array($parts[0], ['api', 'license-api', 'install', 'dist', 'assets', 'uploads'], true)) {
            return $parts[0];
        }
        return '';
    }

    public static function beginTransaction(): bool
    {
        $pdo = self::getInstance();
        return $pdo->inTransaction() ? true : $pdo->beginTransaction();
    }

    public static function commit(): bool
    {
        $pdo = self::getInstance();
        return $pdo->inTransaction() ? $pdo->commit() : true;
    }

    public static function rollBack(): bool
    {
        $pdo = self::getInstance();
        return $pdo->inTransaction() ? $pdo->rollBack() : true;
    }

    // ==========================================
    // DUAL DATABASE REPLICATION (LOCAL + ONLINE)
    // ==========================================

    private static ?PDO $onlineInstance = null;
    private static bool $onlineAttempted = false;

    public static function getOnlineInstance(): ?PDO
    {
        if (self::$onlineInstance !== null) {
            return self::$onlineInstance;
        }

        if (self::$onlineAttempted) {
            return null;
        }

        self::$onlineAttempted = true;
        $onlineConfig = self::$config['online_db'] ?? [];
        if (empty($onlineConfig['enabled'])) {
            return null;
        }

        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $onlineConfig['host'] ?? '127.0.0.1',
                (int)($onlineConfig['port'] ?? 3306),
                $onlineConfig['database'] ?? '',
                $onlineConfig['charset'] ?? 'utf8mb4'
            );

            $pdo = new PDO($dsn, $onlineConfig['username'] ?? '', $onlineConfig['password'] ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 4,
            ]);

            self::$onlineInstance = $pdo;
            return self::$onlineInstance;
        } catch (\Throwable $e) {
            error_log('[DualDB] Online database connection failed: ' . $e->getMessage());
            return null;
        }
    }

    public static function syncProductToOnline(int $productId): bool
    {
        $online = self::getOnlineInstance();
        if (!$online) return false;

        try {
            $local = self::getInstance();
            $stmt = $local->prepare('SELECT * FROM `products` WHERE `id` = :id LIMIT 1');
            $stmt->execute([':id' => $productId]);
            $p = $stmt->fetch();
            if (!$p) return false;

            $stmtCheck = $online->prepare('SELECT `id` FROM `products` WHERE `sku` = :sku LIMIT 1');
            $stmtCheck->execute([':sku' => $p['sku']]);
            $existingId = $stmtCheck->fetchColumn();

            if ($existingId) {
                $sql = 'UPDATE `products` SET
                    `barcode` = :bc, `name` = :name, `name_ar` = :name_ar,
                    `category_id` = :cid, `unit_id` = :uid, `type` = :type,
                    `cost_price` = :cost, `selling_price` = :price, `secondary_selling_price` = :sec_price,
                    `pack_price` = :pack_price, `pack_barcode` = :pack_bc, `pack_quantity` = :pack_qty,
                    `min_order_price` = :min_price, `min_order_qty` = :min_qty,
                    `track_inventory` = :track, `alert_quantity` = :alert, `scale_plu` = :plu,
                    `image_url` = :img, `is_online` = :is_online,
                    `low_stock_local` = :low_local, `low_stock_online` = :low_online,
                    `is_active` = :active
                    WHERE `id` = :id';
                $stmtUpd = $online->prepare($sql);
                $stmtUpd->execute([
                    ':bc' => $p['barcode'], ':name' => $p['name'], ':name_ar' => $p['name_ar'],
                    ':cid' => $p['category_id'], ':uid' => $p['unit_id'], ':type' => $p['type'] ?? 'STANDARD',
                    ':cost' => $p['cost_price'], ':price' => $p['selling_price'], ':sec_price' => $p['secondary_selling_price'],
                    ':pack_price' => $p['pack_price'] ?? 0, ':pack_bc' => $p['pack_barcode'] ?? null, ':pack_qty' => $p['pack_quantity'] ?? 1,
                    ':min_price' => $p['min_order_price'] ?? 0, ':min_qty' => $p['min_order_qty'] ?? 1,
                    ':track' => $p['track_inventory'], ':alert' => $p['alert_quantity'], ':plu' => $p['scale_plu'],
                    ':img' => $p['image_url'], ':is_online' => $p['is_online'] ?? 1,
                    ':low_local' => $p['low_stock_local'] ?? 5, ':low_online' => $p['low_stock_online'] ?? 5,
                    ':active' => $p['is_active'], ':id' => $existingId
                ]);
            } else {
                $sql = 'INSERT INTO `products` (
                    `sku`, `barcode`, `name`, `name_ar`, `category_id`, `unit_id`, `type`,
                    `cost_price`, `selling_price`, `secondary_selling_price`,
                    `pack_price`, `pack_barcode`, `pack_quantity`, `min_order_price`, `min_order_qty`,
                    `track_inventory`, `alert_quantity`, `scale_plu`, `image_url`,
                    `is_online`, `low_stock_local`, `low_stock_online`, `is_active`
                ) VALUES (
                    :sku, :bc, :name, :name_ar, :cid, :uid, :type,
                    :cost, :price, :sec_price,
                    :pack_price, :pack_bc, :pack_qty, :min_price, :min_qty,
                    :track, :alert, :plu, :img,
                    :is_online, :low_local, :low_online, :active
                )';
                $stmtIns = $online->prepare($sql);
                $stmtIns->execute([
                    ':sku' => $p['sku'], ':bc' => $p['barcode'], ':name' => $p['name'], ':name_ar' => $p['name_ar'],
                    ':cid' => $p['category_id'], ':uid' => $p['unit_id'], ':type' => $p['type'] ?? 'STANDARD',
                    ':cost' => $p['cost_price'], ':price' => $p['selling_price'], ':sec_price' => $p['secondary_selling_price'],
                    ':pack_price' => $p['pack_price'] ?? 0, ':pack_bc' => $p['pack_barcode'] ?? null, ':pack_qty' => $p['pack_quantity'] ?? 1,
                    ':min_price' => $p['min_order_price'] ?? 0, ':min_qty' => $p['min_order_qty'] ?? 1,
                    ':track' => $p['track_inventory'], ':alert' => $p['alert_quantity'], ':plu' => $p['scale_plu'],
                    ':img' => $p['image_url'], ':is_online' => $p['is_online'] ?? 1,
                    ':low_local' => $p['low_stock_local'] ?? 5, ':low_online' => $p['low_stock_online'] ?? 5,
                    ':active' => $p['is_active']
                ]);
            }
            return true;
        } catch (\Throwable $e) {
            error_log('[DualDB] syncProductToOnline error: ' . $e->getMessage());
            return false;
        }
    }

    public static function syncCategoryToOnline(int $categoryId): bool
    {
        $online = self::getOnlineInstance();
        if (!$online) return false;

        try {
            $local = self::getInstance();
            $stmt = $local->prepare('SELECT * FROM `categories` WHERE `id` = :id LIMIT 1');
            $stmt->execute([':id' => $categoryId]);
            $c = $stmt->fetch();
            if (!$c) return false;

            $stmtCheck = $online->prepare('SELECT `id` FROM `categories` WHERE `name` = :n LIMIT 1');
            $stmtCheck->execute([':n' => $c['name']]);
            $existingId = $stmtCheck->fetchColumn();

            if ($existingId) {
                $stmtUpd = $online->prepare('UPDATE `categories` SET `name_ar` = :nar, `color` = :col, `icon` = :ico, `sort_order` = :so, `is_active` = :act WHERE `id` = :id');
                $stmtUpd->execute([
                    ':nar' => $c['name_ar'], ':col' => $c['color'], ':ico' => $c['icon'],
                    ':so' => $c['sort_order'], ':act' => $c['is_active'], ':id' => $existingId
                ]);
            } else {
                $stmtIns = $online->prepare('INSERT INTO `categories` (`name`, `name_ar`, `color`, `icon`, `sort_order`, `is_active`) VALUES (:n, :nar, :col, :ico, :so, :act)');
                $stmtIns->execute([
                    ':n' => $c['name'], ':nar' => $c['name_ar'], ':col' => $c['color'],
                    ':ico' => $c['icon'], ':so' => $c['sort_order'], ':act' => $c['is_active']
                ]);
            }
            return true;
        } catch (\Throwable $e) {
            error_log('[DualDB] syncCategoryToOnline error: ' . $e->getMessage());
            return false;
        }
    }

    public static function syncAllToOnline(): array
    {
        $online = self::getOnlineInstance();
        if (!$online) {
            return ['success' => false, 'message' => 'Online database is not enabled or connection failed.'];
        }

        $local = self::getInstance();

        // 1. Sync Categories
        $cats = $local->query('SELECT `id` FROM `categories`')->fetchAll();
        $catsCount = 0;
        foreach ($cats as $c) {
            if (self::syncCategoryToOnline((int)$c['id'])) $catsCount++;
        }

        // 2. Sync Products
        $prods = $local->query('SELECT `id` FROM `products`')->fetchAll();
        $prodsCount = 0;
        foreach ($prods as $p) {
            if (self::syncProductToOnline((int)$p['id'])) $prodsCount++;
        }

        return [
            'success' => true,
            'message' => "Successfully replicated {$catsCount} categories and {$prodsCount} products to the Online Database.",
            'categories_synced' => $catsCount,
            'products_synced' => $prodsCount,
        ];
    }
}
