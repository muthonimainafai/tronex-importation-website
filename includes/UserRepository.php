<?php
declare(strict_types=1);

namespace Tronex;

final class UserRepository
{
    private static function defaultProfile(): array
    {
        return [
            'passportUrl' => '',
            'companyName' => '',
            'legalName' => '',
            'idNumber' => '',
            'postalAddress' => '',
            'deliveryDetails' => '',
            'secondaryMobile' => '',
            'displayUsername' => '',
            'consigneeType' => '',
            'representative' => ['name' => '', 'idNo' => '', 'mobile' => '', 'cityTown' => ''],
            'inquiryMessage' => '',
            'inquiryAttachmentUrl' => '',
        ];
    }

    private static function defaultUploads(): array
    {
        return [
            'bankSlips' => [],
            'paymentSlips' => ['first' => '', 'second' => '', 'third' => ''],
            'consigneeDocUrl' => '',
            'consigneeDocs' => [
                'nationalIdFront' => '', 'nationalIdBack' => '',
                'certificateOfIncorporation' => '', 'businessRegistration' => '',
                'passport' => '', 'alienId' => '',
                'militaryFront' => '', 'militaryBack' => '', 'diplomatId' => '',
            ],
            'pinDocUrl' => '',
            'pinDocs' => [
                'personalPin' => '', 'companyPin' => '',
                'businessNamePin' => '', 'nonResidentPin' => '',
            ],
            'otherUploads' => ['slot1' => '', 'slot2' => ''],
            'logbookCopyUrl' => '',
        ];
    }

    public static function rowToApi(array $row, bool $withSensitive = false): array
    {
        $id = (int) $row['id'];
        $profile = decode_json_column($row['profile_json'] ?? null, self::defaultProfile());
        $uploads = decode_json_column($row['uploads_json'] ?? null, self::defaultUploads());
        $accountDetails = decode_json_column($row['account_details_json'] ?? null, []);

        $out = [
            '_id' => (string) $id,
            'id' => $id,
            'firstName' => $row['first_name'],
            'lastName' => $row['last_name'],
            'email' => $row['email'],
            'mobileNumber' => $row['mobile_number'],
            'address' => $row['address'] ?? '',
            'city' => $row['city'] ?? '',
            'country' => $row['country'] ?? '',
            'role' => $row['role'],
            'customerId' => $row['customer_id'],
            'isActive' => (bool) $row['is_active'],
            'profile' => is_array($profile) ? $profile : self::defaultProfile(),
            'uploads' => is_array($uploads) ? $uploads : self::defaultUploads(),
            'accountDetails' => is_array($accountDetails) ? $accountDetails : [],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];

        if ($withSensitive) {
            $out['password'] = $row['password'];
        }

        return $out;
    }

    public static function generateCustomerId(): string
    {
        return 'CUS-' . date('Ymd') . '-' . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row) : null;
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([strtolower(trim($email))]);
        $row = $stmt->fetch();
        return $row ? self::rowToApi($row, true) : null;
    }

    public static function create(array $data): array
    {
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $customerId = self::generateCustomerId();

        $sql = 'INSERT INTO users (
            first_name, last_name, email, mobile_number, address, city, country,
            password, role, customer_id, profile_json, uploads_json, account_details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        $pdo = Database::pdo();
        $pdo->prepare($sql)->execute([
            $data['firstName'],
            $data['lastName'],
            strtolower(trim($data['email'])),
            $data['mobileNumber'],
            $data['address'] ?? '',
            $data['city'] ?? '',
            $data['country'] ?? '',
            $hash,
            'customer',
            $customerId,
            encode_json_column(self::defaultProfile()),
            encode_json_column(self::defaultUploads()),
            encode_json_column([]),
        ]);

        return self::findById((int) $pdo->lastInsertId()) ?? [];
    }

    public static function verifyPassword(array $userWithHash, string $password): bool
    {
        $hash = $userWithHash['password'] ?? '';
        return $hash !== '' && password_verify($password, $hash);
    }

    public static function updateProfile(int $id, array $body): ?array
    {
        $user = self::findById($id);
        if (!$user) {
            return null;
        }

        $firstName = $body['firstName'] ?? $user['firstName'];
        $lastName = $body['lastName'] ?? $user['lastName'];
        $mobile = $body['mobileNumber'] ?? $user['mobileNumber'];
        $address = $body['address'] ?? $user['address'];
        $city = $body['city'] ?? $user['city'];
        $country = $body['country'] ?? $user['country'];
        $email = isset($body['email']) ? strtolower(trim((string) $body['email'])) : $user['email'];

        $profile = $user['profile'];
        if (!empty($body['profile']) && is_array($body['profile'])) {
            $p = $body['profile'];
            $rep = $p['representative'] ?? [];
            $prevRep = $profile['representative'] ?? [];
            $profile = array_merge($profile, [
                'companyName' => $p['companyName'] ?? $profile['companyName'] ?? '',
                'legalName' => $p['legalName'] ?? $profile['legalName'] ?? '',
                'idNumber' => $p['idNumber'] ?? $profile['idNumber'] ?? '',
                'postalAddress' => $p['postalAddress'] ?? $profile['postalAddress'] ?? '',
                'deliveryDetails' => $p['deliveryDetails'] ?? $profile['deliveryDetails'] ?? '',
                'secondaryMobile' => $p['secondaryMobile'] ?? $profile['secondaryMobile'] ?? '',
                'displayUsername' => $p['displayUsername'] ?? $profile['displayUsername'] ?? '',
                'consigneeType' => $p['consigneeType'] ?? $profile['consigneeType'] ?? '',
                'inquiryMessage' => $p['inquiryMessage'] ?? $profile['inquiryMessage'] ?? '',
                'representative' => [
                    'name' => $rep['name'] ?? $prevRep['name'] ?? '',
                    'idNo' => $rep['idNo'] ?? $prevRep['idNo'] ?? '',
                    'mobile' => $rep['mobile'] ?? $prevRep['mobile'] ?? '',
                    'cityTown' => $rep['cityTown'] ?? $prevRep['cityTown'] ?? '',
                ],
            ]);
        }

        $passwordSql = '';
        $params = [$firstName, $lastName, $mobile, $address, $city, $country, $email, encode_json_column($profile), $id];

        if (!empty($body['newPassword'])) {
            $passwordSql = ', password = ?';
            array_splice($params, -1, 0, [password_hash((string) $body['newPassword'], PASSWORD_BCRYPT)]);
        }

        $sql = "UPDATE users SET
            first_name = ?, last_name = ?, mobile_number = ?, address = ?, city = ?, country = ?,
            email = ?, profile_json = ?{$passwordSql}, updated_at = NOW()
            WHERE id = ?";

        Database::pdo()->prepare($sql)->execute($params);

        return self::findById($id);
    }

    public static function setJsonPath(int $id, string $column, array $path, mixed $value): void
    {
        $user = self::findById($id);
        if (!$user) {
            return;
        }

        $root = $column === 'uploads' ? $user['uploads'] : ($column === 'profile' ? $user['profile'] : []);
        $ref = &$root;
        $keys = explode('.', $path[0] ?? '');
        foreach ($keys as $i => $key) {
            if ($i === count($keys) - 1) {
                $ref[$key] = $value;
            } else {
                if (!isset($ref[$key]) || !is_array($ref[$key])) {
                    $ref[$key] = [];
                }
                $ref = &$ref[$key];
            }
        }

        $col = $column === 'uploads' ? 'uploads_json' : 'profile_json';
        Database::pdo()->prepare("UPDATE users SET {$col} = ?, updated_at = NOW() WHERE id = ?")
            ->execute([encode_json_column($root), $id]);
    }

    public static function pushBankSlips(int $id, array $slips): void
    {
        $user = self::findById($id);
        if (!$user) {
            return;
        }
        $uploads = $user['uploads'];
        $uploads['bankSlips'] = array_merge($uploads['bankSlips'] ?? [], $slips);
        Database::pdo()->prepare('UPDATE users SET uploads_json = ?, updated_at = NOW() WHERE id = ?')
            ->execute([encode_json_column($uploads), $id]);
    }

    /** @return array<string, string> dot-path => column */
    public static function uploadSlotPaths(): array
    {
        return [
            'passport' => 'profile.passportUrl',
            'payment-first' => 'uploads.paymentSlips.first',
            'payment-second' => 'uploads.paymentSlips.second',
            'payment-third' => 'uploads.paymentSlips.third',
            'consignee-id-front' => 'uploads.consigneeDocs.nationalIdFront',
            'consignee-id-back' => 'uploads.consigneeDocs.nationalIdBack',
            'consignee-coi' => 'uploads.consigneeDocs.certificateOfIncorporation',
            'consignee-business-reg' => 'uploads.consigneeDocs.businessRegistration',
            'consignee-passport' => 'uploads.consigneeDocs.passport',
            'consignee-alien' => 'uploads.consigneeDocs.alienId',
            'consignee-military-front' => 'uploads.consigneeDocs.militaryFront',
            'consignee-military-back' => 'uploads.consigneeDocs.militaryBack',
            'consignee-diplomat' => 'uploads.consigneeDocs.diplomatId',
            'pin-personal' => 'uploads.pinDocs.personalPin',
            'pin-company' => 'uploads.pinDocs.companyPin',
            'pin-business' => 'uploads.pinDocs.businessNamePin',
            'pin-non-resident' => 'uploads.pinDocs.nonResidentPin',
            'other-1' => 'uploads.otherUploads.slot1',
            'other-2' => 'uploads.otherUploads.slot2',
            'logbook' => 'uploads.logbookCopyUrl',
            'inquiry-attach' => 'profile.inquiryAttachmentUrl',
        ];
    }

    public static function applyUploadPath(int $userId, string $dotPath, string $url): void
    {
        $user = self::findById($userId);
        if (!$user) {
            return;
        }

        $parts = explode('.', $dotPath);
        $column = $parts[0];
        $data = $column === 'profile' ? $user['profile'] : $user['uploads'];
        $ref = &$data;
        for ($i = 1; $i < count($parts); $i++) {
            $key = $parts[$i];
            if ($i === count($parts) - 1) {
                $ref[$key] = $url;
            } else {
                if (!isset($ref[$key]) || !is_array($ref[$key])) {
                    $ref[$key] = [];
                }
                $ref = &$ref[$key];
            }
        }

        $col = $column === 'profile' ? 'profile_json' : 'uploads_json';
        Database::pdo()->prepare("UPDATE users SET {$col} = ?, updated_at = NOW() WHERE id = ?")
            ->execute([encode_json_column($data), $userId]);
    }
}
