<?php
declare(strict_types=1);

$root = dirname(__DIR__);

if (is_file($root . '/vendor/autoload.php')) {
    require_once $root . '/vendor/autoload.php';
} elseif (PHP_SAPI !== 'cli') {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "PHP dependencies missing. Run: composer install --no-dev\nSee HOSTING.md for setup.";
    exit;
}

require_once $root . '/includes/helpers.php';
require_once $root . '/includes/Config.php';
require_once $root . '/includes/Database.php';
require_once $root . '/includes/Auth.php';
require_once $root . '/includes/CarRepository.php';
require_once $root . '/includes/UserRepository.php';
require_once $root . '/includes/InvoiceRepository.php';
require_once $root . '/includes/ImageService.php';
require_once $root . '/includes/PdfService.php';
require_once $root . '/includes/EmailService.php';
require_once $root . '/includes/view.php';

Tronex\Config::load($root);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
