<?php
declare(strict_types=1);

namespace Tronex;

final class ImageService
{
    public static function carsUploadDir(): string
    {
        $dir = Config::root() . '/public/uploads/cars';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    public static function customersUploadDir(int $userId): string
    {
        $dir = Config::root() . '/public/uploads/customers/' . $userId;
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    public static function optimizeCarImage(string $filePath): string
    {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $optimizedPath = preg_replace('/\.[^.]+$/', '-optimized.webp', $filePath) ?? $filePath . '-optimized.webp';

        if (!function_exists('imagecreatefromjpeg')) {
            return basename($filePath);
        }

        try {
            $img = match ($ext) {
                'png' => imagecreatefrompng($filePath),
                'gif' => imagecreatefromgif($filePath),
                'webp' => imagecreatefromwebp($filePath),
                default => imagecreatefromjpeg($filePath),
            };
            if ($img === false) {
                return basename($filePath);
            }

            $w = imagesx($img);
            $h = imagesy($img);
            $maxW = 1200;
            $maxH = 800;
            if ($w > $maxW || $h > $maxH) {
                $ratio = min($maxW / $w, $maxH / $h);
                $nw = (int) ($w * $ratio);
                $nh = (int) ($h * $ratio);
                $resized = imagecreatetruecolor($nw, $nh);
                imagecopyresampled($resized, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
                imagedestroy($img);
                $img = $resized;
            }

            if (function_exists('imagewebp')) {
                imagewebp($img, $optimizedPath, 80);
                imagedestroy($img);
                if (is_file($filePath)) {
                    @unlink($filePath);
                }
                return basename($optimizedPath);
            }

            imagedestroy($img);
        } catch (\Throwable) {
            // keep original
        }

        return basename($filePath);
    }

    public static function handleCarUpload(array $file): array
    {
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($file['type'] ?? '', $allowed, true)) {
            throw new \InvalidArgumentException('Only image files are allowed (JPEG, PNG, WebP, GIF)');
        }
        if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
            throw new \InvalidArgumentException('File too large (max 5MB)');
        }

        $dir = self::carsUploadDir();
        $name = 'car-' . time() . '-' . random_int(100000000, 999999999) . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Failed to save upload');
        }

        $optimized = self::optimizeCarImage($dest);
        return [
            'filename' => $optimized,
            'url' => '/uploads/cars/' . $optimized,
            'size' => $file['size'] ?? 0,
        ];
    }

    public static function deleteCarImage(string $filename): bool
    {
        $dir = realpath(self::carsUploadDir());
        $path = realpath($dir . '/' . basename($filename));
        if (!$path || !str_starts_with($path, $dir)) {
            return false;
        }
        return is_file($path) && unlink($path);
    }

    public static function handleCustomerUpload(int $userId, array $file): string
    {
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!in_array($file['type'] ?? '', $allowed, true)) {
            throw new \InvalidArgumentException('Only images or PDF files are allowed');
        }
        if (($file['size'] ?? 0) > 10 * 1024 * 1024) {
            throw new \InvalidArgumentException('File too large (max 10MB)');
        }

        $dir = self::customersUploadDir($userId);
        $safe = preg_replace('/[^a-zA-Z0-9.\-_]/', '_', $file['name'] ?? 'file') ?? 'file';
        $name = time() . '-' . $safe;
        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Failed to save upload');
        }
        return '/uploads/customers/' . $userId . '/' . $name;
    }
}
