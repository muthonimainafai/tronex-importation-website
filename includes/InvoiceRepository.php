<?php
declare(strict_types=1);

namespace Tronex;

final class InvoiceRepository
{
    private const ALLOWED_EARLY = [10000, 20000, 30000];

    public static function normalizeEarlyPaymentDiscount(mixed $raw): int
    {
        $n = (int) round((float) $raw);
        return in_array($n, self::ALLOWED_EARLY, true) ? $n : 0;
    }

    public static function earlyPaymentDiscountLabel(int $amount): string
    {
        return match ($amount) {
            30000 => 'Payment within 24hrs — KES 30,000',
            20000 => 'Payment within 48hrs — KES 20,000',
            10000 => 'Payment within 72hrs — KES 10,000',
            default => '',
        };
    }

    public static function buildPerCarInvoice(array $car, int $earlyDiscount = 0): array
    {
        $vm = build_car_invoice_view_model($car);
        $early = self::normalizeEarlyPaymentDiscount($earlyDiscount);
        $subtotalBeforeEarly = (float) $vm['totalCosts'];
        $total = max(0, $subtotalBeforeEarly - $early);

        $items = array_map(fn ($it) => [
            'label' => $it['label'],
            'value' => (float) ($it['value'] ?? 0),
        ], $vm['items']);

        return array_merge($vm, [
            'items' => $items,
            'earlyPaymentDiscount' => $early,
            'earlyPaymentDiscountLabel' => self::earlyPaymentDiscountLabel($early),
            'subtotalBeforeEarly' => $subtotalBeforeEarly,
            'totalCosts' => $total,
        ]);
    }

    public static function rowToApi(array $row): array
    {
        $id = (int) $row['id'];
        return [
            '_id' => (string) $id,
            'id' => $id,
            'carId' => (string) $row['car_id'],
            'customerId' => $row['customer_id'] ? (string) $row['customer_id'] : null,
            'invoiceNumber' => $row['invoice_number'],
            'dateIssued' => $row['date_issued'],
            'expiryDate' => $row['expiry_date'],
            'carDetails' => decode_json_column($row['car_details_json'] ?? null, []),
            'customerDetails' => decode_json_column($row['customer_details_json'] ?? null, []),
            'invoiceItems' => decode_json_column($row['invoice_items_json'] ?? null, []),
            'subtotal' => (float) $row['subtotal'],
            'totalCost' => (float) $row['total_cost'],
            'bankDetails' => decode_json_column($row['bank_details_json'] ?? null, []),
            'mpesaDetails' => decode_json_column($row['mpesa_details_json'] ?? null, []),
            'claimClause' => $row['claim_clause'],
            'notes' => $row['notes'],
            'status' => $row['status'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    public static function generateInvoiceNumber(): string
    {
        $count = (int) Database::pdo()->query('SELECT COUNT(*) FROM invoices')->fetchColumn();
        return sprintf('INV-%s-%04d', date('Ymd'), $count + 1);
    }

    public static function buildInvoiceItemsFromProforma(array $perCar): array
    {
        $items = [];
        foreach ($perCar['items'] ?? [] as $it) {
            $cost = (float) ($it['value'] ?? 0);
            if ($cost !== 0.0) {
                $items[] = ['description' => $it['label'], 'cost' => $cost];
            }
        }
        if (($perCar['dutyPayable'] ?? 0) > 0) {
            $items[] = ['description' => 'Duty Payable', 'cost' => (float) $perCar['dutyPayable']];
        }
        if (($perCar['discount'] ?? 0) > 0) {
            $items[] = ['description' => 'Discount', 'cost' => -(float) $perCar['discount']];
        }
        if (($perCar['earlyPaymentDiscount'] ?? 0) > 0) {
            $hint = $perCar['earlyPaymentDiscountLabel'] ? ' (' . $perCar['earlyPaymentDiscountLabel'] . ')' : '';
            $items[] = [
                'description' => 'Early payment discount' . $hint,
                'cost' => -(float) $perCar['earlyPaymentDiscount'],
            ];
        }
        return $items;
    }

    public static function createProformaRecord(array $car, array $customer, int $earlyDiscount): array
    {
        $perCar = self::buildPerCarInvoice($car, $earlyDiscount);
        $items = self::buildInvoiceItemsFromProforma($perCar);
        $subtotal = array_sum(array_map(fn ($it) => (float) $it['cost'], $items));
        $total = (float) $perCar['totalCosts'];
        $expiryDays = (int) (Config::get('INVOICE_EXPIRY_DAYS', '30') ?: 30);
        $expiry = date('Y-m-d H:i:s', time() + max(0, $expiryDays) * 86400);

        $carDetails = [
            'make' => $car['make'],
            'model' => $car['model'],
            'year' => $car['year'],
            'internalStockNumber' => $car['internalStockNumber'],
            'externalStockNumber' => $car['externalStockNumber'] ?? '',
            'listPriceKes' => $car['price'],
            'finalAmountDueKes' => $total,
            'subtotalBeforeEarlyPaymentKes' => $perCar['subtotalBeforeEarly'],
            'earlyPaymentDiscountAppliedKes' => $perCar['earlyPaymentDiscount'],
            'type' => $car['type'],
            'bodyType' => $car['bodyType'],
            'transmission' => $car['transmission'],
            'fuel' => $car['fuel'],
            'mileage' => $car['mileage'],
            '_id' => $car['_id'],
        ];

        $customerDetails = [
            'customerId' => (string) ($customer['customerId'] ?? $customer['_id']),
            'firstName' => $customer['firstName'],
            'lastName' => $customer['lastName'],
            'email' => $customer['email'],
            'mobileNumber' => $customer['mobileNumber'],
            'address' => $customer['address'],
            'city' => $customer['city'],
            'country' => $customer['country'],
        ];

        $bank = $perCar['bank'];
        $sql = 'INSERT INTO invoices (
            car_id, customer_id, invoice_number, expiry_date,
            car_details_json, customer_details_json, invoice_items_json,
            subtotal, total_cost, bank_details_json, mpesa_details_json,
            status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        $pdo = Database::pdo();
        $number = self::generateInvoiceNumber();
        $pdo->prepare($sql)->execute([
            (int) $car['id'],
            (int) $customer['id'],
            $number,
            $expiry,
            encode_json_column($carDetails),
            encode_json_column($customerDetails),
            encode_json_column($items),
            $subtotal,
            $total,
            encode_json_column([
                'bankName' => $bank['bankName'],
                'accountName' => $bank['accountName'],
                'branchCode' => $bank['branchCode'],
                'branch' => $bank['branch'],
                'accountNumber' => $bank['accountNumber'],
                'swiftCode' => $bank['swiftCode'],
            ]),
            encode_json_column([
                'paybillNumber' => (string) ($bank['paybill'] ?? ''),
                'accountName' => 'TRONEX',
            ]),
            'Issued',
            sprintf(
                'Customer proforma from website. Payable: KES %.2f.',
                $total
            ),
        ]);

        return self::findById((int) $pdo->lastInsertId()) ?? [];
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM invoices WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row) : null;
    }

    public static function findByNumber(string $num): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM invoices WHERE invoice_number = ? LIMIT 1');
        $stmt->execute([$num]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row) : null;
    }

    public static function resolveByAnyId(string $ref): ?array
    {
        if (ctype_digit($ref)) {
            return self::findById((int) $ref);
        }
        return self::findByNumber($ref);
    }

    public static function findByCarId(int $carId): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM invoices WHERE car_id = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([$carId]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row) : null;
    }

    public static function linkCustomer(int $invoiceId, array $customer): ?array
    {
        $details = [
            'customerId' => (string) ($customer['customerId'] ?? $customer['_id']),
            'firstName' => $customer['firstName'],
            'lastName' => $customer['lastName'],
            'email' => $customer['email'],
            'mobileNumber' => $customer['mobileNumber'],
            'address' => $customer['address'],
            'city' => $customer['city'],
            'country' => $customer['country'],
        ];
        Database::pdo()->prepare(
            'UPDATE invoices SET customer_id = ?, customer_details_json = ?, updated_at = NOW() WHERE id = ?'
        )->execute([(int) $customer['id'], encode_json_column($details), $invoiceId]);

        return self::findById($invoiceId);
    }
}
