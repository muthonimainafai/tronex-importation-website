<?php
declare(strict_types=1);

namespace Tronex;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class Auth
{
    public static function jwtSecret(): string
    {
        $s = Config::get('JWT_SECRET');
        if (!$s || strlen($s) < 16) {
            if (Config::isProduction()) {
                throw new \RuntimeException('Set JWT_SECRET in .env (at least 16 characters).');
            }
            return 'dev-only-insecure-jwt-secret';
        }
        return $s;
    }

    public static function signUserToken(int $userId, string $email, string $role): string
    {
        $payload = [
            'id' => $userId,
            'email' => $email,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + 7 * 86400,
        ];
        return JWT::encode($payload, self::jwtSecret(), 'HS256');
    }

    public static function signAdminPanelToken(): string
    {
        $expires = Config::get('ADMIN_JWT_EXPIRES_IN', '8h');
        $seconds = 8 * 3600;
        if (preg_match('/^(\d+)h$/i', $expires, $m)) {
            $seconds = (int) $m[1] * 3600;
        }
        $payload = [
            'typ' => 'admin',
            'v' => 1,
            'role' => 'admin',
            'iat' => time(),
            'exp' => time() + $seconds,
        ];
        return JWT::encode($payload, self::jwtSecret(), 'HS256');
    }

    public static function decodeToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key(self::jwtSecret(), 'HS256'));
            return (array) $decoded;
        } catch (\Throwable) {
            return null;
        }
    }

    public static function getBearerToken(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
            return trim($m[1]);
        }
        $cookies = parse_cookies();
        return $cookies['tronex_token'] ?? null;
    }

    public static function isAdminPayload(?array $decoded): bool
    {
        if (!$decoded) {
            return false;
        }
        return ($decoded['typ'] ?? '') === 'admin' || ($decoded['role'] ?? '') === 'admin';
    }

    public static function requireAdminJson(): ?array
    {
        $token = self::getBearerToken();
        if (!$token) {
            json_response(['success' => false, 'message' => 'Admin authentication required'], 401);
        }
        $decoded = self::decodeToken($token);
        if (!$decoded || !self::isAdminPayload($decoded)) {
            json_response(['success' => false, 'message' => 'Admin access required'], 403);
        }
        return $decoded;
    }

    public static function requireUserJson(): array
    {
        $token = self::getBearerToken();
        if (!$token) {
            json_response(['success' => false, 'message' => 'No token provided'], 401);
        }
        $decoded = self::decodeToken($token);
        if (!$decoded || empty($decoded['id'])) {
            json_response(['success' => false, 'message' => 'Invalid token'], 403);
        }
        return $decoded;
    }

    public static function secureComparePassword(string $input, string $expected): bool
    {
        return hash_equals(
            hash('sha256', $input),
            hash('sha256', $expected)
        );
    }

    public static function requireCustomerPage(): array
    {
        $token = self::getBearerToken();
        if (!$token) {
            $next = urlencode($_SERVER['REQUEST_URI'] ?? '/');
            header('Location: /login?next=' . $next);
            exit;
        }
        $decoded = self::decodeToken($token);
        if (!$decoded || ($decoded['role'] ?? '') !== 'customer') {
            $next = urlencode($_SERVER['REQUEST_URI'] ?? '/');
            header('Location: /login?next=' . $next);
            exit;
        }
        return $decoded;
    }

    public static function requireUserPage(): array
    {
        $token = self::getBearerToken();
        if (!$token) {
            $next = urlencode($_SERVER['REQUEST_URI'] ?? '/');
            header('Location: /login?next=' . $next);
            exit;
        }
        $decoded = self::decodeToken($token);
        if (!$decoded) {
            $next = urlencode($_SERVER['REQUEST_URI'] ?? '/');
            header('Location: /login?next=' . $next);
            exit;
        }
        return $decoded;
    }
}
