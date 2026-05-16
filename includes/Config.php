<?php
declare(strict_types=1);

namespace Tronex;

final class Config
{
    private static array $env = [];
    private static string $root = '';

    public static function load(string $root): void
    {
        self::$root = $root;
        $path = $root . '/.env';
        if (!is_file($path)) {
            return;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $eq = strpos($line, '=');
            if ($eq === false) {
                continue;
            }
            $key = trim(substr($line, 0, $eq));
            $val = trim(substr($line, $eq + 1));
            $val = trim($val, "\"'");
            self::$env[$key] = $val;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        // Prefer values from the project .env file (what you edit locally).
        if (array_key_exists($key, self::$env)) {
            $fromFile = self::$env[$key];
            return $fromFile !== '' ? $fromFile : $default;
        }

        $v = $_ENV[$key] ?? getenv($key);
        if ($v !== false && $v !== '') {
            return (string) $v;
        }
        return $default;
    }

    public static function root(): string
    {
        return self::$root;
    }

    public static function isProduction(): bool
    {
        return (self::get('APP_ENV', 'production') ?: 'production') === 'production';
    }
}
