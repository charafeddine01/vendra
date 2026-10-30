<?php
declare(strict_types=1);

namespace OmniPOS\Controllers;

use OmniPOS\Core\Auth;
use OmniPOS\Core\Database;
use OmniPOS\Core\Response;
use PDO;

class ProductsController
{
    public static function list(array $payload): void
    {
        $pdo = Database::getInstance();
        $search = trim((string)($payload['search'] ?? ''));
        $categoryId = !empty($payload['category_id']) ? (int)$payload['category_id'] : null;
        $type = !empty($payload['type']) ? (string)$payload['type'] : null;

        $sql = 'SELECT p.*, c.name as category_name, c.color as category_color, u.code as unit_code, u.is_fractional, tr.rate_percent as tax_rate_percent, COALESCE(si.quantity, 0) as stock_quantity
                FROM `products` p
                LEFT JOIN `categories` c ON p.category_id = c.id
                LEFT JOIN `units` u ON p.unit_id = u.id
                LEFT JOIN `tax_rates` tr ON p.tax_rate_id = tr.id
                LEFT JOIN `stock_inventory` si ON p.id = si.product_id AND si.variant_id IS NULL AND si.warehouse_id = 1
                WHERE p.is_active = 1';

        $params = [];

        if (!empty($search)) {
            $sql .= ' AND (p.name LIKE :s1 OR p.name_ar LIKE :s2 OR p.sku LIKE :s3 OR p.barcode LIKE :s4 OR p.scale_plu LIKE :s5)';
            $like = "%{$search}%";
            $params[':s1'] = $like;
            $params[':s2'] = $like;
            $params[':s3'] = $like;
            $params[':s4'] = $like;
            $params[':s5'] = $like;
        }

        if ($categoryId) {
            $sql .= ' AND p.category_id = :cid';
            $params[':cid'] = $categoryId;
        }

        if ($type) {
            $sql .= ' AND p.type = :type';
            $params[':type'] = $type;
        }

        // Keep zero stock at the end of the list
        $sql .= ' ORDER BY (CASE WHEN COALESCE(si.quantity, 0) > 0 THEN 0 ELSE 1 END) ASC, p.id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        Response::success(['products' => $products]);
    }

    public static function get(array $payload): void
    {
        $id = (int)($payload['id'] ?? 0);
        $pdo = Database::getInstance();

        $stmt = $pdo->prepare('SELECT * FROM `products` WHERE `id` = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $product = $stmt->fetch();

        if (!$product) {
            Response::error('Product not found.', 404);
        }

        // Fetch variants
        $stmtVar = $pdo->prepare('SELECT * FROM `product_variants` WHERE `product_id` = :pid');
        $stmtVar->execute([':pid' => $id]);
        $variants = $stmtVar->fetchAll();

        // Fetch recipes
        $stmtRec = $pdo->prepare('SELECT pr.*, p.name as ingredient_name, u.code as unit_code FROM `product_recipes` pr JOIN `products` p ON pr.ingredient_product_id = p.id JOIN `units` u ON pr.unit_id = u.id WHERE pr.parent_product_id = :pid');
        $stmtRec->execute([':pid' => $id]);
        $recipes = $stmtRec->fetchAll();

        // Fetch multi-units
        $stmtUnits = $pdo->prepare('SELECT pu.*, u.name as unit_name FROM `product_units` pu JOIN `units` u ON pu.unit_id = u.id WHERE pu.product_id = :pid');
        $stmtUnits->execute([':pid' => $id]);
        $units = $stmtUnits->fetchAll();

        Response::success([
            'product' => $product,
            'variants' => $variants,
            'recipes' => $recipes,
            'units' => $units,
        ]);
    }

    public static function save(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);

        $pdo = Database::getInstance();
        $id = !empty($payload['id']) ? (int)$payload['id'] : null;

        $sku = trim((string)($payload['sku'] ?? ''));
        $name = trim((string)($payload['name'] ?? ''));
        $nameAr = $payload['name_ar'] ?? null;
        $barcode = trim((string)($payload['barcode'] ?? '')) ?: null;
        $categoryId = !empty($payload['category_id']) ? (int)$payload['category_id'] : null;
        $unitId = (int)($payload['unit_id'] ?? 1);
        $taxRateId = !empty($payload['tax_rate_id']) ? (int)$payload['tax_rate_id'] : null;
        $type = $payload['type'] ?? 'STANDARD';
        $costPrice = (float)($payload['cost_price'] ?? 0);
        $sellingPrice = (float)($payload['selling_price'] ?? 0);
        $secPrice = (float)($payload['secondary_selling_price'] ?? ($sellingPrice * 0.92));
        $trackInventory = isset($payload['track_inventory']) ? (int)$payload['track_inventory'] : 1;
        $alertQty = (float)($payload['alert_quantity'] ?? 5);
        $scalePlu = trim((string)($payload['scale_plu'] ?? '')) ?: null;
        $imageUrl = $payload['image_url'] ?? null;
        $modifiers = !empty($payload['modifiers_schema']) ? (is_string($payload['modifiers_schema']) ? $payload['modifiers_schema'] : json_encode($payload['modifiers_schema'])) : null;
        $isKitchen = !empty($payload['is_kitchen_item']) ? 1 : 0;
        $kitchenStation = $payload['kitchen_station'] ?? 'Kitchen';
        $warrantyMonths = (int)($payload['warranty_months'] ?? 0);
        $packPrice = (float)($payload['pack_price'] ?? 0);
        $packBarcode = trim((string)($payload['pack_barcode'] ?? '')) ?: null;
        $packQuantity = (int)($payload['pack_quantity'] ?? 1);
        $minOrderPrice = (float)($payload['min_order_price'] ?? 0);
        $minOrderQty = (int)($payload['min_order_qty'] ?? 1);
        $isOnline = isset($payload['is_online']) ? ((int)$payload['is_online'] ? 1 : 0) : 1;
        $lowStockLocal = (int)($payload['low_stock_local'] ?? 5);
        $lowStockOnline = (int)($payload['low_stock_online'] ?? 5);
        $stockInputMode = $payload['stock_input_mode'] ?? 'UNITS'; // 'UNITS' or 'PACKS'
        $extraBarcodes = !empty($payload['extra_barcodes']) && is_array($payload['extra_barcodes']) ? $payload['extra_barcodes'] : [];

        if (empty($name)) {
            Response::error('Product name is required.', 400);
        }

        if (empty($sku)) {
            $sku = 'SKU-' . strtoupper(bin2hex(random_bytes(4)));
        }

        Database::beginTransaction();

        try {
            if ($id) {
                $sql = 'UPDATE `products` SET
                    `sku` = :sku, `barcode` = :bc, `name` = :name, `name_ar` = :name_ar,
                    `category_id` = :cid, `unit_id` = :uid, `tax_rate_id` = :trid, `type` = :type,
                    `cost_price` = :cost, `selling_price` = :price, `secondary_selling_price` = :sec_price,
                    `pack_price` = :pack_price, `pack_barcode` = :pack_bc, `pack_quantity` = :pack_qty,
                    `min_order_price` = :min_price, `min_order_qty` = :min_qty,
                    `track_inventory` = :track, `alert_quantity` = :alert, `scale_plu` = :plu,
                    `image_url` = :img, `modifiers_schema` = :modifiers, `is_kitchen_item` = :kitch,
                    `kitchen_station` = :station, `warranty_months` = :warr,
                    `is_online` = :is_online, `low_stock_local` = :low_local, `low_stock_online` = :low_online
                    WHERE `id` = :id';
                $params = [
                    ':sku' => $sku, ':bc' => $barcode, ':name' => $name, ':name_ar' => $nameAr,
                    ':cid' => $categoryId, ':uid' => $unitId, ':trid' => $taxRateId, ':type' => $type,
                    ':cost' => $costPrice, ':price' => $sellingPrice, ':sec_price' => $secPrice,
                    ':pack_price' => $packPrice, ':pack_bc' => $packBarcode, ':pack_qty' => $packQuantity,
                    ':min_price' => $minOrderPrice, ':min_qty' => $minOrderQty,
                    ':track' => $trackInventory, ':alert' => $alertQty, ':plu' => $scalePlu,
                    ':img' => $imageUrl, ':modifiers' => $modifiers, ':kitch' => $isKitchen,
                    ':station' => $kitchenStation, ':warr' => $warrantyMonths,
                    ':is_online' => $isOnline, ':low_local' => $lowStockLocal, ':low_online' => $lowStockOnline,
                    ':id' => $id,
                ];
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $productId = $id;
            } else {
                $sql = 'INSERT INTO `products` (
                    `sku`, `barcode`, `name`, `name_ar`, `category_id`, `unit_id`, `tax_rate_id`,
                    `type`, `cost_price`, `selling_price`, `secondary_selling_price`,
                    `pack_price`, `pack_barcode`, `pack_quantity`, `min_order_price`, `min_order_qty`,
                    `track_inventory`, `alert_quantity`, `scale_plu`, `image_url`,
                    `modifiers_schema`, `is_kitchen_item`, `kitchen_station`, `warranty_months`,
                    `is_online`, `low_stock_local`, `low_stock_online`
                ) VALUES (
                    :sku, :bc, :name, :name_ar, :cid, :uid, :trid,
                    :type, :cost, :price, :sec_price,
                    :pack_price, :pack_bc, :pack_qty, :min_price, :min_qty,
                    :track, :alert, :plu, :img,
                    :modifiers, :kitch, :station, :warr,
                    :is_online, :low_local, :low_online
                )';
                $params = [
                    ':sku' => $sku, ':bc' => $barcode, ':name' => $name, ':name_ar' => $nameAr,
                    ':cid' => $categoryId, ':uid' => $unitId, ':trid' => $taxRateId,
                    ':type' => $type, ':cost' => $costPrice, ':price' => $sellingPrice, ':sec_price' => $secPrice,
                    ':pack_price' => $packPrice, ':pack_bc' => $packBarcode, ':pack_qty' => $packQuantity,
                    ':min_price' => $minOrderPrice, ':min_qty' => $minOrderQty,
                    ':track' => $trackInventory, ':alert' => $alertQty, ':plu' => $scalePlu, ':img' => $imageUrl,
                    ':modifiers' => $modifiers, ':kitch' => $isKitchen, ':station' => $kitchenStation, ':warr' => $warrantyMonths,
                    ':is_online' => $isOnline, ':low_local' => $lowStockLocal, ':low_online' => $lowStockOnline,
                ];
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $productId = (int)$pdo->lastInsertId();

                // Initialize stock record (If entered as packs, convert to total individual units)
                $rawStock = (float)($payload['initial_stock'] ?? 10);
                $initialStock = ($stockInputMode === 'PACKS' && $packQuantity > 1) ? ($rawStock * $packQuantity) : $rawStock;

                $stmtStock = $pdo->prepare('INSERT INTO `stock_inventory` (`product_id`, `warehouse_id`, `quantity`) VALUES (:pid, 1, :qty)');
                $stmtStock->execute([':pid' => $productId, ':qty' => $initialStock]);
            }

            // Save variants if variable
            if ($type === 'VARIABLE' && !empty($payload['variants'])) {
                foreach ($payload['variants'] as $v) {
                    $vSku = $v['sku'] ?? ($sku . '-' . strtoupper(bin2hex(random_bytes(2))));
                    $vName = $v['variant_name'] ?? 'Variant';
                    $vCost = (float)($v['cost_price'] ?? $costPrice);
                    $vPrice = (float)($v['selling_price'] ?? $sellingPrice);
                    $vBc = $v['barcode'] ?? null;
                    $vMatrix = json_encode($v['attribute_matrix'] ?? []);

                    if (!empty($v['id'])) {
                        $stmtUpdVar = $pdo->prepare('UPDATE `product_variants` SET `sku` = :sku, `barcode` = :bc, `variant_name` = :vn, `cost_price` = :cp, `selling_price` = :sp WHERE `id` = :id');
                        $stmtUpdVar->execute([':sku' => $vSku, ':bc' => $vBc, ':vn' => $vName, ':cp' => $vCost, ':sp' => $vPrice, ':id' => $v['id']]);
                    } else {
                        $stmtInsVar = $pdo->prepare('INSERT INTO `product_variants` (`product_id`, `sku`, `barcode`, `variant_name`, `attribute_matrix`, `cost_price`, `selling_price`) VALUES (:pid, :sku, :bc, :vn, :mat, :cp, :sp)');
                        $stmtInsVar->execute([':pid' => $productId, ':sku' => $vSku, ':bc' => $vBc, ':vn' => $vName, ':mat' => $vMatrix, ':cp' => $vCost, ':sp' => $vPrice]);
                    }
                }
            }

            // Save recipes if combo
            if ($type === 'COMBO' && isset($payload['recipes'])) {
                $pdo->prepare('DELETE FROM `product_recipes` WHERE `parent_product_id` = :pid')->execute([':pid' => $productId]);
                $stmtInsRec = $pdo->prepare('INSERT INTO `product_recipes` (`parent_product_id`, `ingredient_product_id`, `quantity`, `unit_id`) VALUES (:ppid, :ipid, :qty, :uid)');
                foreach ($payload['recipes'] as $rec) {
                    $stmtInsRec->execute([
                        ':ppid' => $productId,
                        ':ipid' => (int)$rec['ingredient_product_id'],
                        ':qty' => (float)$rec['quantity'],
                        ':uid' => (int)($rec['unit_id'] ?? 1),
                    ]);
                }
            }

            // Save extra barcodes
            $pdo->prepare('DELETE FROM `product_barcodes` WHERE `product_id` = :pid')->execute([':pid' => $productId]);
            if (!empty($extraBarcodes)) {
                $stmtInsBarcode = $pdo->prepare('INSERT INTO `product_barcodes` (`product_id`, `barcode`, `label`) VALUES (:pid, :bc, :label)');
                foreach ($extraBarcodes as $eb) {
                    $ebBarcode = trim((string)($eb['barcode'] ?? ''));
                    if (empty($ebBarcode)) continue;
                    $stmtInsBarcode->execute([
                        ':pid'   => $productId,
                        ':bc'    => $ebBarcode,
                        ':label' => $eb['label'] ?? null,
                    ]);
                }
            }

            Database::commit();

            // Replicate to online database if configured
            try {
                Database::syncProductToOnline($productId);
            } catch (\Throwable $t) {
                error_log('[DualDB] Replicate product failed: ' . $t->getMessage());
            }

            Response::success(['product_id' => $productId], 200, 'Product saved successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to save product: ' . $e->getMessage(), 500);
        }
    }

    public static function delete(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $id = (int)($payload['id'] ?? 0);
        $pdo = Database::getInstance();
        $stmt = $pdo->prepare('UPDATE `products` SET `is_active` = 0 WHERE `id` = :id');
        $stmt->execute([':id' => $id]);

        try {
            $online = Database::getOnlineInstance();
            if ($online) {
                $online->prepare('UPDATE `products` SET `is_active` = 0 WHERE `id` = :id')->execute([':id' => $id]);
            }
        } catch (\Throwable $t) {}

        Response::success(null, 200, 'Product deactivated.');
    }

    public static function categories(array $payload): void
    {
        $pdo = Database::getInstance();
        $stmt = $pdo->query('SELECT * FROM `categories` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
        Response::success(['categories' => $stmt->fetchAll()]);
    }

    public static function saveCategory(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $pdo = Database::getInstance();
        $id = !empty($payload['id']) ? (int)$payload['id'] : null;
        $name = trim((string)($payload['name'] ?? ''));
        $nameAr = !empty($payload['name_ar']) ? trim((string)$payload['name_ar']) : null;
        $color = !empty($payload['color']) ? trim((string)$payload['color']) : '#3b82f6';
        $icon = !empty($payload['icon']) ? trim((string)$payload['icon']) : 'Package';
        $sortOrder = (int)($payload['sort_order'] ?? 0);

        if (empty($name)) {
            Response::error('Category name is required.', 400);
        }

        if ($id) {
            $stmt = $pdo->prepare('UPDATE `categories` SET `name` = :name, `name_ar` = :name_ar, `color` = :color, `icon` = :icon, `sort_order` = :sort WHERE `id` = :id');
            $stmt->execute([':name' => $name, ':name_ar' => $nameAr, ':color' => $color, ':icon' => $icon, ':sort' => $sortOrder, ':id' => $id]);
            $catId = $id;
        } else {
            $stmt = $pdo->prepare('INSERT INTO `categories` (`name`, `name_ar`, `color`, `icon`, `sort_order`, `is_active`) VALUES (:name, :name_ar, :color, :icon, :sort, 1)');
            $stmt->execute([':name' => $name, ':name_ar' => $nameAr, ':color' => $color, ':icon' => $icon, ':sort' => $sortOrder]);
            $catId = (int)$pdo->lastInsertId();
        }

        // Replicate to online database
        try {
            Database::syncCategoryToOnline($catId);
        } catch (\Throwable $t) {}

        Response::success(['id' => $catId], 200, 'Category saved successfully.');
    }

    public static function deleteCategory(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            Response::error('Invalid category ID.', 400);
        }
        $pdo = Database::getInstance();
        $stmt = $pdo->prepare('UPDATE `categories` SET `is_active` = 0 WHERE `id` = :id');
        $stmt->execute([':id' => $id]);

        try {
            $online = Database::getOnlineInstance();
            if ($online) {
                $online->prepare('UPDATE `categories` SET `is_active` = 0 WHERE `id` = :id')->execute([':id' => $id]);
            }
        } catch (\Throwable $t) {}

        Response::success(null, 200, 'Category deleted successfully.');
    }

    public static function syncAllToOnline(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $res = Database::syncAllToOnline();
        if ($res['success']) {
            Response::success($res, 200, $res['message']);
        } else {
            Response::error($res['message'], 400, $res);
        }
    }

    public static function getOnlineDbConfig(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $envFile = __DIR__ . '/../config/env.php';
        if (function_exists('opcache_invalidate')) {
            opcache_invalidate($envFile, true);
        }
        $env = file_exists($envFile) ? (include $envFile) : [];
        $cfg = $env['online_db'] ?? [];

        Response::success([
            'enabled'      => !empty($cfg['enabled']),
            'driver'       => $cfg['driver'] ?? 'mysql',
            'host'         => $cfg['host'] ?? '127.0.0.1',
            'port'         => (int)($cfg['port'] ?? 3306),
            'database'     => $cfg['database'] ?? '',
            'username'     => $cfg['username'] ?? '',
            'has_password' => !empty($cfg['password']),
        ]);
    }

    public static function testOnlineDbConnection(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $host = trim((string)($payload['host'] ?? '127.0.0.1'));
        $port = (int)($payload['port'] ?? 3306);
        $database = trim((string)($payload['database'] ?? ''));
        $username = trim((string)($payload['username'] ?? ''));
        $password = (string)($payload['password'] ?? '');

        if ($password === '' || $password === null) {
            $envFile = __DIR__ . '/../config/env.php';
            $env = file_exists($envFile) ? (require $envFile) : [];
            $password = $env['online_db']['password'] ?? '';
        }

        if (empty($database) || empty($username)) {
            Response::error('Database name and username are required to test connection.', 400);
        }

        try {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $database);
            $pdo = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $ver = $pdo->query('SELECT VERSION()')->fetchColumn();
            Response::success([
                'connected' => true,
                'version'   => $ver,
                'message'   => "Successfully connected to MySQL database (Version {$ver}).",
            ]);
        } catch (\Throwable $e) {
            Response::error("Connection failed: " . $e->getMessage(), 400, ['connected' => false, 'error' => $e->getMessage()]);
        }
    }

    public static function saveOnlineDbConfig(array $payload): void
    {
        Auth::requireRole(['ADMIN', 'MANAGER']);
        $envFile = __DIR__ . '/../config/env.php';
        $env = file_exists($envFile) ? (require $envFile) : [];

        $existingPassword = $env['online_db']['password'] ?? '';
        $newPassword = isset($payload['password']) && $payload['password'] !== ''
            ? (string)$payload['password']
            : $existingPassword;

        $env['online_db'] = [
            'enabled'   => !empty($payload['enabled']),
            'driver'    => 'mysql',
            'host'      => trim((string)($payload['host'] ?? '127.0.0.1')),
            'port'      => (int)($payload['port'] ?? 3306),
            'database'  => trim((string)($payload['database'] ?? '')),
            'username'  => trim((string)($payload['username'] ?? '')),
            'password'  => $newPassword,
            'charset'   => 'utf8mb4',
        ];

        $envCopy = $env;
        if (isset($envCopy['db']['driver']) && $envCopy['db']['driver'] === 'sqlite') {
            $envCopy['db']['database'] = '__APP_DATABASE_PATH__';
        }

        $code = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($envCopy, true) . ";\n";
        $code = str_replace("'__APP_DATABASE_PATH__'", "__DIR__ . '/../../database/omnipos.sqlite'", $code);
        if (file_put_contents($envFile, $code, LOCK_EX) === false) {
            Response::error('Failed to write configuration file.', 500);
        }

        if (function_exists('opcache_invalidate')) {
            opcache_invalidate($envFile, true);
            opcache_invalidate(__DIR__ . '/../config.php', true);
        }

        Database::resetOnlineInstance();

        $savedConfig = $env['online_db'];
        $savedConfig['has_password'] = !empty($savedConfig['password']);
        unset($savedConfig['password']);

        Response::success($savedConfig, 200, 'Online database configuration saved successfully.');
    }

    public static function units(array $payload): void
    {
        $pdo = Database::getInstance();
        $stmt = $pdo->query('SELECT * FROM `units` ORDER BY `id` ASC');
        Response::success(['units' => $stmt->fetchAll()]);
    }

    public static function taxRates(array $payload): void
    {
        $pdo = Database::getInstance();
        $stmt = $pdo->query('SELECT * FROM `tax_rates` WHERE `is_active` = 1');
        Response::success(['tax_rates' => $stmt->fetchAll()]);
    }
}
