<?php
declare(strict_types=1);

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return $_POST ?: [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Subdirectory prefix when app is not at domain root (e.g. /tronex-importation-website).
 * Empty string when served at root (production) or via virtual host at /.
 */
function app_base_path(): string
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $fromEnv = \Tronex\Config::get('APP_BASE_PATH');
    if ($fromEnv !== null && $fromEnv !== '') {
        $cached = '/' . trim($fromEnv, '/');
        if ($cached === '/') {
            $cached = '';
        }
        return $cached;
    }

    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $dir = str_replace('\\', '/', dirname($script));
    if ($dir === '/' || $dir === '.' || $dir === '') {
        $cached = '';
    } else {
        $cached = $dir;
    }
    return $cached;
}

/** Build an app URL path (always starts with /, includes subdirectory prefix). */
function url_path(string $path): string
{
    $path = '/' . ltrim($path, '/');
    $base = app_base_path();
    if ($base === '') {
        return $path;
    }
    return $base . $path;
}

function request_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = $uri !== false ? $uri : '/';
    $base = app_base_path();
    if ($base !== '' && str_starts_with($path, $base)) {
        $path = substr($path, strlen($base)) ?: '/';
    }
    return $path === '' ? '/' : $path;
}

/** Rewrite root-absolute href/src/action in HTML for subdirectory installs. */
function apply_app_base_to_html(string $html): string
{
    $base = app_base_path();
    if ($base === '') {
        return $html;
    }
    $prefix = rtrim($base, '/') . '/';
    return preg_replace(
        '#\b(href|src|action)=(["\'])/(?!/)#',
        '$1=$2' . $prefix,
        $html
    ) ?? $html;
}

function inject_tronex_head_assets(string $html): string
{
    $base = app_base_path();
    $meta = '<meta name="tronex-base" content="' . e($base) . '">';
    $navCss = '<link rel="stylesheet" href="' . e(url_path('/css/tronex-public-nav.css')) . '">';
    $script = '<script src="' . e(url_path('/js/tronex-base.js')) . '"></script>';
    $navScript = '<script src="' . e(url_path('/js/tronex-public-nav.js')) . '" defer></script>';
    $inject = $meta . $navCss . $script . $navScript;

    if (preg_match('/<head[^>]*>/i', $html)) {
        return preg_replace('/<head[^>]*>/i', '$0' . $inject, $html, 1) ?? $html;
    }
    return $inject . $html;
}

/** Active state for main public nav (matches customer routes). */
function tronex_public_nav_link_class(string $path, string $current): string
{
    $base = ' nav-link';
    if ($path === '/') {
        return ($current === '/' || $current === '') ? $base . ' active' : $base;
    }
    if ($current === $path) {
        return $base . ' active';
    }
    if ($path === '/stock-list' && preg_match('#^/car/\d+$#', $current)) {
        return $base . ' active';
    }
    return $base;
}

/**
 * Canonical customer navbar — same links on every public page (injected via <!-- TRONEX_PUBLIC_NAV -->).
 */
function tronex_public_nav_html(): string
{
    $cur = request_path();
    if ($cur !== '/' && $cur !== '' && str_ends_with($cur, '/')) {
        $cur = rtrim($cur, '/') ?: '/';
    }

    $lc = static function (string $path) use ($cur): string {
        return tronex_public_nav_link_class($path, $cur);
    };

    $u = static fn(string $path): string => e(url_path($path));
    $contactHref = e(url_path('/') . '#site-footer');
    $logoSrc = e(url_path('/images/logos/tronexlogo2.jpeg'));

    return '<nav class="navbar tronex-public-nav" aria-label="Main navigation">'
        . '<div class="nav-container">'
        . '<div class="nav-logo">'
        . '<img src="' . $logoSrc . '" alt="Tronex logo" class="nav-logo-img" width="56" height="56">'
        . '<a href="' . $u('/') . '">Tronex Car Importers Ltd</a>'
        . '</div>'
        . '<div class="hamburger" role="button" tabindex="0" aria-label="Open menu"><span></span><span></span><span></span></div>'
        . '<ul class="nav-menu">'
        . '<li><a href="' . $u('/') . '" class="' . trim($lc('/')) . '">Home</a></li>'
        . '<li><a href="' . $u('/stock-list') . '" class="' . trim($lc('/stock-list')) . '">Stock List</a></li>'
        . '<li><a href="' . $u('/about-us') . '" class="' . trim($lc('/about-us')) . '">About Us</a></li>'
        . '<li><a href="' . $u('/vessel-schedule') . '" class="' . trim($lc('/vessel-schedule')) . '">Vessel Schedule</a></li>'
        . '<li><a href="' . $u('/clearing-forwarding') . '" class="' . trim($lc('/clearing-forwarding')) . '">Clearing &amp; Forwarding</a></li>'
        . '<li><a href="' . $u('/testimonials') . '" class="' . trim($lc('/testimonials')) . '">Testimonials</a></li>'
        . '<li><a href="' . $contactHref . '" class="nav-link">Contact</a></li>'
        . '<li id="authNavRegister"><a href="' . $u('/register') . '" class="' . trim(tronex_public_nav_link_class('/register', $cur)) . '">Register</a></li>'
        . '<li id="authNavLogin"><a href="' . $u('/login') . '" class="' . trim(tronex_public_nav_link_class('/login', $cur)) . '">Login</a></li>'
        . '<li id="authNavProfile" class="auth-hidden"><a href="' . $u('/my-profile') . '" class="' . trim(tronex_public_nav_link_class('/my-profile', $cur)) . '">My Profile</a></li>'
        . '<li id="authNavLogout" class="auth-hidden"><a href="javascript:void(0)" class="nav-link">Logout</a></li>'
        . '</ul></div></nav>';
}

/** Replace nav placeholders with the canonical public navbar. */
function inject_tronex_public_nav(string $html): string
{
    $nav = tronex_public_nav_html();
    $html = str_replace('<!-- TRONEX_PUBLIC_NAV -->', $nav, $html);
    return str_replace('<!-- TRONEX_NAVBAR -->', $nav, $html);
}

/** Full HTML pipeline for user-facing pages (nav → base path rewrite → head assets). */
function finalize_tronex_html(string $html): string
{
    $html = inject_tronex_public_nav($html);
    $html = apply_app_base_to_html($html);
    return inject_tronex_head_assets($html);
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function parse_cookies(): array
{
    $out = [];
    $header = $_SERVER['HTTP_COOKIE'] ?? '';
    if ($header === '') {
        return $out;
    }
    foreach (explode(';', $header) as $part) {
        $idx = strpos($part, '=');
        if ($idx === false) {
            continue;
        }
        $k = trim(substr($part, 0, $idx));
        $v = trim(substr($part, $idx + 1));
        if ($k !== '') {
            $out[$k] = urldecode($v);
        }
    }
    return $out;
}

function to_num_or_null(mixed $v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    $n = is_numeric($v) ? (float) $v : null;
    return ($n !== null && is_finite($n)) ? $n : null;
}

function to_finite_number(mixed $v): float
{
    if (is_float($v) || is_int($v)) {
        return is_finite((float) $v) ? (float) $v : NAN;
    }
    if ($v === null) {
        return NAN;
    }
    $s = trim((string) $v);
    if ($s === '') {
        return NAN;
    }
    $s = str_replace(',', '', $s);
    $s = preg_replace('/[^0-9.\-]/', '', $s) ?? '';
    if ($s === '' || $s === '.' || $s === '-' || $s === '-.') {
        return NAN;
    }
    $n = (float) $s;
    return is_finite($n) ? $n : NAN;
}

function format_stock_id(mixed $raw): mixed
{
    if ($raw === null || $raw === '') {
        return $raw;
    }
    $s = is_string($raw) ? trim($raw) : (string) $raw;
    if (preg_match('/^TRON(\d{2})-(\d{5})$/i', $s, $m)) {
        return 'TRON' . $m[1] . '-' . $m[2];
    }
    if (preg_match('/^TRON-(\d{2})-(\d{5})$/i', $s, $m)) {
        return 'TRON' . $m[1] . '-' . $m[2];
    }
    $digits = preg_replace('/\D/', '', $s) ?? '';
    $yy = substr((string) date('Y'), -2);
    if (strlen($digits) >= 7) {
        return 'TRON' . substr($digits, 0, 2) . '-' . str_pad(substr($digits, -5), 5, '0', STR_PAD_LEFT);
    }
    if ($digits !== '') {
        return 'TRON' . $yy . '-' . str_pad(substr($digits, -5), 5, '0', STR_PAD_LEFT);
    }
    return $s;
}

function build_car_invoice_view_model(array $car): array
{
    $costs = $car['invoiceCosts'] ?? [];
    $itemized = [
        ['key' => 'cif', 'label' => 'Cost insurance and Freight (CIF)', 'value' => to_num_or_null($costs['cif'] ?? null)],
        ['key' => 'portCfsCharges', 'label' => 'Port/Cfs Charges', 'value' => to_num_or_null($costs['portCfsCharges'] ?? null)],
        ['key' => 'shippingLineDo', 'label' => 'Shipping line/D.O', 'value' => to_num_or_null($costs['shippingLineDo'] ?? null)],
        ['key' => 'radiation', 'label' => 'Radiation', 'value' => to_num_or_null($costs['radiation'] ?? null)],
        ['key' => 'mssLevy', 'label' => 'MSS Levy', 'value' => to_num_or_null($costs['mssLevy'] ?? null)],
        ['key' => 'clearingServiceCharge', 'label' => 'Clearing service Charge', 'value' => to_num_or_null($costs['clearingServiceCharge'] ?? null)],
        ['key' => 'kgPlate', 'label' => 'KG Plate (cic ins. comp.insured)', 'value' => to_num_or_null($costs['kgPlate'] ?? null)],
        ['key' => 'ntsaSticker', 'label' => 'NTSA Sticker', 'value' => to_num_or_null($costs['ntsaSticker'] ?? null)],
        ['key' => 'handlingCosts', 'label' => 'Handling Costs', 'value' => to_num_or_null($costs['handlingCosts'] ?? null)],
    ];
    $itemizedTotal = array_sum(array_map(fn ($it) => (float) ($it['value'] ?? 0), $itemized));
    $duty = (float) (to_num_or_null($costs['dutyPayable'] ?? null) ?? 0);
    $discount = (float) (to_num_or_null($costs['discount'] ?? null) ?? 0);
    $total = max(0, $itemizedTotal + $duty - $discount);

    return [
        'currency' => $costs['currency'] ?? 'KES',
        'items' => $itemized,
        'dutyPayable' => $duty,
        'discount' => $discount,
        'itemizedNeedAnalysisTotal' => $itemizedTotal,
        'itemizedDutyTaxesTotal' => $duty,
        'totalCosts' => $total,
        'bank' => [
            'bankName' => 'Bank of Africa Kenya Ltd.',
            'accountName' => 'Tronex Car Importers Ltd',
            'branchCode' => '015',
            'branch' => 'Changamwe, Mombasa',
            'accountNumber' => '02482480002',
            'swiftCode' => 'AFRIKENX',
            'paybill' => '972900',
        ],
    ];
}

function get_display_price_ksh(array $car): float
{
    $costs = $car['invoiceCosts'] ?? [];
    $keys = ['cif', 'portCfsCharges', 'shippingLineDo', 'radiation', 'mssLevy', 'clearingServiceCharge', 'kgPlate', 'ntsaSticker', 'handlingCosts'];
    $toNum = static function ($v): float {
        if (is_numeric($v)) {
            return max(0, (float) $v);
        }
        $c = preg_replace('/[^\d.-]/', '', (string) $v) ?? '';
        return is_numeric($c) ? max(0, (float) $c) : 0;
    };
    $hasInvoice = false;
    foreach ($keys as $k) {
        if ($toNum($costs[$k] ?? 0) > 0) {
            $hasInvoice = true;
            break;
        }
    }
    if (!$hasInvoice && $toNum($costs['dutyPayable'] ?? 0) <= 0 && $toNum($costs['discount'] ?? 0) <= 0) {
        return $toNum($car['price'] ?? 0);
    }
    $itemized = array_sum(array_map(fn ($k) => $toNum($costs[$k] ?? 0), $keys));
    return max(0, $itemized + $toNum($costs['dutyPayable'] ?? 0) - $toNum($costs['discount'] ?? 0));
}

function decode_json_column(?string $json, mixed $default = null): mixed
{
    if ($json === null || $json === '') {
        return $default;
    }
    $d = json_decode($json, true);
    return json_last_error() === JSON_ERROR_NONE ? $d : $default;
}

function encode_json_column(mixed $data): ?string
{
    if ($data === null) {
        return null;
    }
    return json_encode($data, JSON_UNESCAPED_UNICODE);
}
