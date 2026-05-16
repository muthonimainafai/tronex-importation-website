<?php
declare(strict_types=1);

namespace Tronex;

use PDO;

final class CarRepository
{
    public static function rowToApi(array $row): array
    {
        $id = (int) $row['id'];
        $highlights = decode_json_column($row['highlights_json'] ?? null, []);
        $features = decode_json_column($row['features_json'] ?? null, []);
        $images = decode_json_column($row['images_json'] ?? null, []);
        $invoiceCosts = decode_json_column($row['invoice_costs_json'] ?? null, []);

        return [
            '_id' => (string) $id,
            'id' => $id,
            'carId' => $row['car_id'],
            'internalStockNumber' => format_stock_id($row['internal_stock_number']),
            'externalStockNumber' => $row['external_stock_number'] ?? '',
            'name' => $row['make'] . ' ' . $row['model'],
            'make' => $row['make'],
            'model' => $row['model'],
            'year' => (int) $row['year'],
            'price' => round((float) $row['price'], 2),
            'availability' => $row['availability'],
            'type' => $row['type'],
            'bodyType' => $row['body_type'],
            'color' => $row['color'],
            'interiorColor' => $row['interior_color'],
            'doors' => (int) $row['doors'],
            'seats' => (int) $row['seats'],
            'mileage' => (int) $row['mileage'],
            'transmission' => $row['transmission'],
            'fuel' => $row['fuel'],
            'drive' => $row['drive'],
            'engineCapacity' => $row['engine_capacity'],
            'trunk' => $row['trunk'],
            'registration' => $row['registration'],
            'description' => $row['description'] ?? '',
            'highlights' => is_array($highlights) ? $highlights : [],
            'features' => is_array($features) ? $features : [],
            'mainImage' => $row['main_image'] ?? '',
            'images' => is_array($images) ? $images : [],
            'badge' => $row['badge'] ?? '',
            'gradientColor' => $row['gradient_color'] ?? '',
            'invoiceCosts' => is_array($invoiceCosts) ? $invoiceCosts : [],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    public static function findAll(): array
    {
        $stmt = Database::pdo()->query('SELECT * FROM cars ORDER BY created_at DESC');
        return array_map([self::class, 'rowToApi'], $stmt->fetchAll());
    }

    public static function findFeatured(int $limit = 6): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM cars WHERE badge = ? ORDER BY created_at DESC LIMIT ?');
        $stmt->bindValue(1, 'Featured');
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return array_map([self::class, 'rowToApi'], $stmt->fetchAll());
    }

    public static function findById(int|string $id): ?array
    {
        if (is_numeric($id)) {
            $stmt = Database::pdo()->prepare('SELECT * FROM cars WHERE id = ? LIMIT 1');
            $stmt->execute([(int) $id]);
            $row = $stmt->fetch();
            return $row ? self::rowToApi($row) : null;
        }
        return self::findByStockOrLegacyId((string) $id);
    }

    public static function findByStockOrLegacyId(string $ref): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT * FROM cars WHERE internal_stock_number = ? OR external_stock_number = ? OR car_id = ? LIMIT 1'
        );
        $stmt->execute([$ref, $ref, $ref]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row) : null;
    }

    public static function getNextInternalStockNumber(): string
    {
        $pdo = Database::pdo();
        $yy = substr((string) date('Y'), -2);
        $fallback = "TRON{$yy}-00200";

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('SELECT sequence_value FROM counters WHERE counter_key = ? FOR UPDATE');
            $stmt->execute(['internalStockNumber']);
            $row = $stmt->fetch();
            if (!$row) {
                $pdo->prepare('INSERT INTO counters (counter_key, sequence_value) VALUES (?, 199)')->execute(['internalStockNumber']);
                $seq = 200;
                $pdo->prepare('UPDATE counters SET sequence_value = ? WHERE counter_key = ?')->execute([$seq, 'internalStockNumber']);
            } else {
                $seq = (int) $row['sequence_value'] + 1;
                $pdo->prepare('UPDATE counters SET sequence_value = ? WHERE counter_key = ?')->execute([$seq, 'internalStockNumber']);
            }
            $pdo->commit();
            return 'TRON' . $yy . '-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
        } catch (\Throwable) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return $fallback;
        }
    }

    public static function create(array $data): array
    {
        $stock = self::getNextInternalStockNumber();
        $carId = 'CAR-' . time() . '-' . random_int(100000, 999999);
        $invoiceCosts = $data['invoiceCosts'] ?? null;

        $sql = 'INSERT INTO cars (
            car_id, internal_stock_number, external_stock_number, make, model, year, price,
            availability, type, body_type, color, interior_color, doors, seats, mileage,
            transmission, fuel, drive, engine_capacity, trunk, registration, description,
            highlights_json, features_json, main_image, images_json, badge, gradient_color, invoice_costs_json
        ) VALUES (
            :car_id, :internal_stock_number, :external_stock_number, :make, :model, :year, :price,
            :availability, :type, :body_type, :color, :interior_color, :doors, :seats, :mileage,
            :transmission, :fuel, :drive, :engine_capacity, :trunk, :registration, :description,
            :highlights_json, :features_json, :main_image, :images_json, :badge, :gradient_color, :invoice_costs_json
        )';

        $pdo = Database::pdo();
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':car_id' => $carId,
            ':internal_stock_number' => $stock,
            ':external_stock_number' => $data['externalStockNumber'] ?? '',
            ':make' => $data['make'],
            ':model' => $data['model'],
            ':year' => (int) $data['year'],
            ':price' => (float) $data['price'],
            ':availability' => $data['availability'] ?? 'Available',
            ':type' => $data['type'] ?? 'Sedan',
            ':body_type' => $data['bodyType'] ?? '',
            ':color' => $data['color'],
            ':interior_color' => $data['interiorColor'] ?? '',
            ':doors' => (int) ($data['doors'] ?? 4),
            ':seats' => (int) ($data['seats'] ?? 5),
            ':mileage' => (int) $data['mileage'],
            ':transmission' => $data['transmission'] ?? 'Automatic',
            ':fuel' => $data['fuel'] ?? 'Petrol',
            ':drive' => $data['drive'] ?? '2WD',
            ':engine_capacity' => $data['engineCapacity'] ?? '',
            ':trunk' => $data['trunk'] ?? '',
            ':registration' => $data['registration'] ?? '',
            ':description' => $data['description'] ?? '',
            ':highlights_json' => encode_json_column($data['highlights'] ?? []),
            ':features_json' => encode_json_column($data['features'] ?? []),
            ':main_image' => $data['mainImage'] ?? '',
            ':images_json' => encode_json_column($data['images'] ?? []),
            ':badge' => $data['badge'] ?? 'Featured',
            ':gradient_color' => $data['gradientColor'] ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            ':invoice_costs_json' => encode_json_column($invoiceCosts),
        ]);

        return self::findById((int) $pdo->lastInsertId()) ?? [];
    }

    public static function update(int $id, array $data): ?array
    {
        $sql = 'UPDATE cars SET
            make = :make, model = :model, year = :year, price = :price,
            availability = :availability, type = :type, body_type = :body_type,
            color = :color, interior_color = :interior_color, doors = :doors, seats = :seats,
            mileage = :mileage, transmission = :transmission, fuel = :fuel, drive = :drive,
            engine_capacity = :engine_capacity, trunk = :trunk, registration = :registration,
            description = :description, highlights_json = :highlights_json, features_json = :features_json,
            main_image = :main_image, images_json = :images_json, badge = :badge,
            gradient_color = :gradient_color, external_stock_number = :external_stock_number,
            invoice_costs_json = :invoice_costs_json, updated_at = NOW()
            WHERE id = :id';

        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([
            ':id' => $id,
            ':make' => $data['make'],
            ':model' => $data['model'],
            ':year' => (int) $data['year'],
            ':price' => (float) $data['price'],
            ':availability' => $data['availability'] ?? 'Available',
            ':type' => $data['type'] ?? 'Sedan',
            ':body_type' => $data['bodyType'] ?? '',
            ':color' => $data['color'],
            ':interior_color' => $data['interiorColor'] ?? '',
            ':doors' => (int) ($data['doors'] ?? 4),
            ':seats' => (int) ($data['seats'] ?? 5),
            ':mileage' => (int) $data['mileage'],
            ':transmission' => $data['transmission'] ?? 'Automatic',
            ':fuel' => $data['fuel'] ?? 'Petrol',
            ':drive' => $data['drive'] ?? '2WD',
            ':engine_capacity' => $data['engineCapacity'] ?? '',
            ':trunk' => $data['trunk'] ?? '',
            ':registration' => $data['registration'] ?? '',
            ':description' => $data['description'] ?? '',
            ':highlights_json' => encode_json_column($data['highlights'] ?? []),
            ':features_json' => encode_json_column($data['features'] ?? []),
            ':main_image' => $data['mainImage'] ?? '',
            ':images_json' => encode_json_column($data['images'] ?? []),
            ':badge' => $data['badge'] ?? 'Featured',
            ':gradient_color' => $data['gradientColor'] ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            ':external_stock_number' => $data['externalStockNumber'] ?? '',
            ':invoice_costs_json' => encode_json_column($data['invoiceCosts'] ?? null),
        ]);

        return self::findById($id);
    }

    public static function delete(int $id): ?array
    {
        $car = self::findById($id);
        if (!$car) {
            return null;
        }
        Database::pdo()->prepare('DELETE FROM cars WHERE id = ?')->execute([$id]);
        return $car;
    }
}
