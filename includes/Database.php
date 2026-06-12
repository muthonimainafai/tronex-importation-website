<?php
declare(strict_types=1);

namespace Tronex;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $host = Config::get('DB_HOST', 'localhost');
        $port = Config::get('DB_PORT', '3306');
        $name = Config::get('DB_NAME', 'tronex_cars');
        $user = Config::get('DB_USER', 'root');
        $pass = Config::get('DB_PASS', '');

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

        try {
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            $hint = 'Check DB_HOST, DB_NAME, DB_USER, and DB_PASS in .env (use the full names from your hosting panel, often with a prefix like username_dbname).';
            if (Config::isProduction()) {
                throw new \RuntimeException('Database connection failed. ' . $hint, 0, $e);
            }
            throw $e;
        }

        return self::$pdo;
    }
}
