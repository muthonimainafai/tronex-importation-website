<?php
declare(strict_types=1);

/**
 * Build a clean header logo PNG from public/images/tronexlogo3.jpeg.
 * Keeps the shield + text; removes textured background.
 */
$root = dirname(__DIR__);
$src = $root . '/public/images/tronexlogo3.jpeg';
$dest = $root . '/public/images/tronexlogo3-nav.png';

$im = @imagecreatefromjpeg($src);
if ($im === false) {
    fwrite(STDERR, "Failed to load: {$src}\n");
    exit(1);
}

$w = imagesx($im);
$h = imagesy($im);
$out = imagecreatetruecolor($w, $h);
imagealphablending($out, false);
imagesavealpha($out, true);
$trans = imagecolorallocatealpha($out, 0, 0, 0, 127);

$isForeground = static function (int $r, int $g, int $b): bool {
    $max = max($r, $g, $b);
    $min = min($r, $g, $b);
    $chroma = $max - $min;
    $luma = (int) round(0.299 * $r + 0.587 * $g + 0.114 * $b);

    // Background: black splatter + brushed metal (low chroma)
    if ($luma < 48) {
        return false;
    }
    if ($chroma < 24 && $luma < 168) {
        return false;
    }

    // Logo colors: orange, blue, bright silver trim
    if ($chroma >= 32) {
        return true;
    }
    if ($luma >= 132 && $chroma >= 16) {
        return true;
    }

    return $luma >= 95 && $chroma >= 26;
};

for ($y = 0; $y < $h; $y++) {
    for ($x = 0; $x < $w; $x++) {
        $c = imagecolorat($im, $x, $y);
        $r = ($c >> 16) & 0xFF;
        $g = ($c >> 8) & 0xFF;
        $b = $c & 0xFF;

        if ($isForeground($r, $g, $b)) {
            $col = imagecolorallocatealpha($out, $r, $g, $b, 0);
            imagesetpixel($out, $x, $y, $col);
        } else {
            imagesetpixel($out, $x, $y, $trans);
        }
    }
}

$minX = $w;
$minY = $h;
$maxX = 0;
$maxY = 0;
for ($y = 0; $y < $h; $y++) {
    for ($x = 0; $x < $w; $x++) {
        if (((imagecolorat($out, $x, $y) >> 24) & 0x7F) > 10) {
            continue;
        }
        $minX = min($minX, $x);
        $minY = min($minY, $y);
        $maxX = max($maxX, $x);
        $maxY = max($maxY, $y);
    }
}

$pad = 8;
$minX = max(0, $minX - $pad);
$minY = max(0, $minY - $pad);
$maxX = min($w - 1, $maxX + $pad);
$maxY = min($h - 1, $maxY + $pad);
$cw = $maxX - $minX + 1;
$ch = $maxY - $minY + 1;

$cropped = imagecreatetruecolor($cw, $ch);
imagealphablending($cropped, false);
imagesavealpha($cropped, true);
imagefill($cropped, 0, 0, imagecolorallocatealpha($cropped, 0, 0, 0, 127));
imagecopy($cropped, $out, 0, 0, $minX, $minY, $cw, $ch);

if (!imagepng($cropped, $dest, 9)) {
    fwrite(STDERR, "Failed to write: {$dest}\n");
    exit(1);
}

imagedestroy($im);
imagedestroy($out);
imagedestroy($cropped);
echo "Wrote {$dest} ({$cw}x{$ch})\n";
