#!/usr/bin/env python3
"""One-off: convert views/car-details.html EJS to views/car-details.php"""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = (root / "views" / "car-details.html").read_text(encoding="utf-8")

php_header = """<?php
$resolvedDisplayPrice = (function () {
    $fromDisplay = (float) ($car['displayPriceKsh'] ?? 0);
    if ($fromDisplay > 0) {
        return $fromDisplay;
    }
    $fromInvoice = (float) ($invoice['totalCosts'] ?? 0);
    if ($fromInvoice > 0) {
        return $fromInvoice;
    }
    $fromCarPrice = (float) ($car['price'] ?? 0);
    return $fromCarPrice > 0 ? $fromCarPrice : 0;
})();
$availClass = strtolower($car['availability'] ?? 'available');
$carTitle = ($car['make'] ?? '') . ' ' . ($car['model'] ?? '');
$mainImg = $car['mainImage'] ?? '';
if ($mainImg === '' && !empty($car['images'][0])) {
    $mainImg = $car['images'][0];
}
if ($mainImg === '') {
    $mainImg = '/images/placeholder-car.svg';
}
$imageCount = is_array($car['images'] ?? null) ? count($car['images']) : 0;
?>
"""

out = re.sub(r"<%\s*const resolvedDisplayPrice[\s\S]*?%>\s*", "", src, count=1)

replacements = [
    ("<%= car.make %> <%= car.model %>", "<?= e($carTitle) ?>"),
    ("<%= resolvedDisplayPrice.toLocaleString() %>", "<?= e(number_format($resolvedDisplayPrice)) ?>"),
    ("<%= car.mileage.toLocaleString() %>", "<?= e(number_format((int) $car['mileage'])) ?>"),
    ("status-<%= car.availability.toLowerCase() %>", "status-<?= e($availClass) ?>"),
    ("<%= car._id %>", "<?= e($car['_id']) ?>"),
    ("<%= car.internalStockNumber || 'N/A' %>", "<?= e($car['internalStockNumber'] ?? 'N/A') ?>"),
    (
        "<%= car.mainImage || ((car.images && car.images[0]) ? car.images[0] : '/images/placeholder-car.svg') %>",
        "<?= e($mainImg) ?>",
    ),
]

for old, new in replacements:
    out = out.replace(old, new)

# Generic simple <%= var %> -> <?= e($var) ?> for remaining car.* fields
def simple_ejs(m):
    expr = m.group(1).strip()
    mapping = {
        "car.year": "$car['year']",
        "car.type": "$car['type']",
        "car.fuel": "$car['fuel']",
        "car.make": "$car['make']",
        "car.model": "$car['model']",
        "car.description": "$car['description']",
        "car.bodyType || 'N/A'": "$car['bodyType'] ?? 'N/A'",
        "car.interiorColor || 'N/A'": "$car['interiorColor'] ?? 'N/A'",
        "car.doors || 'N/A'": "$car['doors'] ?? 'N/A'",
        "car.seats || 'N/A'": "$car['seats'] ?? 'N/A'",
        "car.trunk || 'N/A'": "$car['trunk'] ?? 'N/A'",
        "car.engineCapacity || 'N/A'": "$car['engineCapacity'] ?? 'N/A'",
        "car.transmission": "$car['transmission']",
        "car.drive": "$car['drive']",
        "car.registration || 'N/A'": "$car['registration'] ?? 'N/A'",
        "car.availability": "$car['availability']",
        "car.images.length": "$imageCount",
        "index + 1": "<?= (int) $index + 1 ?>",
        "image": "$image",
    }
    php_expr = mapping.get(expr, expr)
    if expr == "index + 1":
        return "<?= (int) $index + 1 ?>"
    if expr == "image":
        return "<?= e($image) ?>"
    return f"<?= e({php_expr}) ?>"

out = re.sub(r"<%=\s*([^%]+?)\s*%>", simple_ejs, out)

# if blocks
out = out.replace(
    "<% if (car.images && car.images.length > 1) { %>",
    "<?php if ($imageCount > 1): ?>",
)
out = out.replace("<% } %>", "<?php endif; ?>")

out = re.sub(
    r"<% for \(let index = 0; index < car\.images\.length; index\+\+\) \{ const image = car\.images\[index\]; %>",
    "<?php foreach (($car['images'] ?? []) as $index => $image): ?>",
    out,
)
out = out.replace(
    '<motion class="thumbnail-item <%= index === 0 ? \'active\' : \'\' %>" data-index="<%= index %>"',
    '<div class="thumbnail-item <?= $index === 0 ? \'active\' : \'\' ?>" data-index="<?= (int) $index ?>"',
)
out = out.replace(
    "<% car.highlights.forEach(highlight => { %>",
    "<?php foreach (($car['highlights'] ?? []) as $highlight): ?>",
)
out = out.replace(
    "<% car.features.forEach(feature => { %>",
    "<?php foreach (($car['features'] ?? []) as $feature): ?>",
)
out = out.replace("<% }); %>", "<?php endforeach; ?>")

out = out.replace(
    '<div class="thumbnail-item <%= index === 0 ? \'active\' : \'\' %>" data-index="<%= index %>"',
    '<div class="thumbnail-item <?= $index === 0 ? \'active\' : \'\' ?>" data-index="<?= (int) $index ?>"',
)

# highlights/features list items
out = out.replace("<%= highlight %>", "<?= e($highlight) ?>")
out = out.replace("<%= feature %>", "<?= e($feature) ?>")

out = out.replace(
    "<% if (car.highlights && car.highlights.length > 0) { %>",
    "<?php if (!empty($car['highlights'])): ?>",
)
out = out.replace(
    "<% if (car.features && car.features.length > 0) { %>",
    "<?php if (!empty($car['features'])): ?>",
)

(out_path := root / "views" / "car-details.php").write_text(php_header + out, encoding="utf-8")
print("Wrote", out_path)
