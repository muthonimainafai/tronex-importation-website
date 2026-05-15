from pathlib import Path

p = Path(__file__).resolve().parents[1] / "views" / "car-details.php"
t = p.read_text(encoding="utf-8")
t = t.replace(
    '<motion class="thumbnail-item <?= $index === 0 ? \'active\' : \'\' ?>" data-index="<?= (int) $index ?>"',
    '<div class="thumbnail-item <?= $index === 0 ? \'active\' : \'\' ?>" data-index="<?= (int) $index ?>"',
)
# Fix first endforeach in thumbnail loop (was endif)
marker = "thumbnail-strip"
idx = t.find(marker)
if idx != -1:
    sub = t[idx:]
    sub = sub.replace("<?php endif; ?>", "<?php endforeach; ?>", 1)
    t = t[:idx] + sub
p.write_text(t, encoding="utf-8")
print("fixed")
