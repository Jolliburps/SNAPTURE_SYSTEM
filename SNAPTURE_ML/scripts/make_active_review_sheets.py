"""Create temporary contact sheets for manual review of active dataset folders."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "data" / "scope_dataset"
OUT = ROOT / "_active_review_sheets"
OUT.mkdir(exist_ok=True)
SOURCES = {
    "pete_plastic_unclassified": ROOT / "pete_bottles" / "plastic_unclassified",
    "fabric_scraps": ROOT / "fabric_scraps",
    "coconut_shells": ROOT / "coconut_shells",
    "wood_non_recyclable": ROOT / "dry_untreated_wood_scraps" / "Dataset" / "Non-Recyclable",
    "wood_scraps_sample": ROOT / "dry_untreated_wood_scraps",
}
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
thumb_w, thumb_h, cols, rows = 220, 180, 4, 4
try:
    font = ImageFont.truetype("arial.ttf", 14)
except OSError:
    font = ImageFont.load_default()

for name, folder in SOURCES.items():
    iterator = folder.iterdir() if name == "wood_scraps_sample" else folder.rglob("*")
    files = sorted(p for p in iterator if p.is_file() and p.suffix.lower() in EXTENSIONS)
    target = OUT / name
    target.mkdir(exist_ok=True)
    for page, start in enumerate(range(0, len(files), cols * rows), start=1):
        sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), "white")
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(files[start:start + cols * rows]):
            x, y = (index % cols) * thumb_w, (index // cols) * thumb_h
            try:
                with Image.open(path) as image:
                    image = image.convert("RGB")
                    image.thumbnail((thumb_w - 12, thumb_h - 32))
                    sheet.paste(image, (x + (thumb_w - image.width) // 2, y + 4))
            except Exception as exc:
                draw.text((x + 6, y + 6), f"ERROR: {exc}", fill="red", font=font)
            draw.text((x + 6, y + thumb_h - 23), path.name[:30], fill="black", font=font)
        sheet.save(target / f"page_{page:03d}.jpg", quality=90)
    print(f"{name}: {len(files)} images -> {target}")
