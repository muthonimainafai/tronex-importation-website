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
    include $path;
}

function render_static_view(string $name): void
{
    $path = Tronex\Config::root() . '/views/' . $name;
    if (!is_file($path)) {
        http_response_code(404);
        echo 'Page not found — <a href="/">Back to Home</a>';
        return;
    }
    $ext = pathinfo($path, PATHINFO_EXTENSION);
    if ($ext === 'php') {
        render_view($name);
        return;
    }
    header('Content-Type: text/html; charset=utf-8');
    readfile($path);
}
