<?php
declare(strict_types=1);

function render_view(string $name, array $vars = []): void
{
    $path = Tronex\Config::root() . '/views/' . $name;
    if (!is_file($path)) {
        $phpPath = preg_replace('/\.html$/', '.php', $path);
        if (is_file($phpPath)) {
            $path = $phpPath;
        }
    }
    if (!is_file($path)) {
        http_response_code(500);
        echo 'View not found: ' . e($name);
        return;
    }
    extract($vars, EXTR_SKIP);
    ob_start();
    include $path;
    $html = ob_get_clean();
    header('Content-Type: text/html; charset=utf-8');
    echo finalize_tronex_html($html);
}

function render_static_view(string $name): void
{
    $path = Tronex\Config::root() . '/views/' . $name;
    if (!is_file($path)) {
        http_response_code(404);
        echo 'Page not found — <a href="' . e(url_path('/')) . '">Back to Home</a>';
        return;
    }
    $ext = pathinfo($path, PATHINFO_EXTENSION);
    if ($ext === 'php') {
        render_view($name);
        return;
    }
    header('Content-Type: text/html; charset=utf-8');
    $html = file_get_contents($path);
    echo finalize_tronex_html($html ?: '');
}

/** Minimal public page (e.g. “coming soon”) with the same navbar as the rest of the site. */
function render_user_stub(string $title, string $message): void
{
    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        . '<title>' . e($title) . ' - Tronex Car Importers</title>'
        . '<link rel="stylesheet" href="/css/style.css">'
        . '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
        . '</head><body><!-- TRONEX_PUBLIC_NAV -->'
        . '<main class="tronex-stub-main"><h1>' . e($title) . '</h1>'
        . '<p>' . e($message) . '</p>'
        . '<p><a href="' . e(url_path('/')) . '" class="tronex-stub-back">← Back to Home</a></p>'
        . '</main></body></html>';
    header('Content-Type: text/html; charset=utf-8');
    echo finalize_tronex_html($html);
}
