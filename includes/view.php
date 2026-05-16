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
    echo inject_tronex_head_assets(apply_app_base_to_html($html));
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
    echo inject_tronex_head_assets(apply_app_base_to_html($html ?: ''));
}
