from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "data" / "scope_dataset"
SOURCE = ROOT / "candidate_data"
OUT = ROOT / "_review_contact_sheets"
OUT.mkdir(parents=True, exist_ok=True)

folders = [
    "pete_bottles_commons",
    "hdpe_containers_commons",
    "fabric_scraps_commons",
    "fabric_scraps_textile",
    "coconut_shells_commons",
    "dry_untreated_wood_scraps_commons",
    "plastic_unclassified",
]

thumb_w, thumb_h = 220, 180
cols, rows = 4, 4
try:
    font = ImageFont.truetype("arial.ttf", 14)
except OSError:
    font = ImageFont.load_default()

for folder_name in folders:
    folder = SOURCE / folder_name
    files = sorted([p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])
    folder_out = OUT / folder_name
    folder_out.mkdir(parents=True, exist_ok=True)
    for page, start in enumerate(range(0, len(files), cols * rows), start=1):
        page_files = files[start:start + cols * rows]
        sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), "white")
        draw = ImageDraw.Draw(sheet)
        for idx, path in enumerate(page_files):
            x = (idx % cols) * thumb_w
            y = (idx // cols) * thumb_h
            try:
                with Image.open(path) as im:
                    im = im.convert("RGB")
                    im.thumbnail((thumb_w - 12, thumb_h - 32))
                    px = x + (thumb_w - im.width) // 2
                    py = y + 4
                    sheet.paste(im, (px, py))
            except Exception as exc:
                draw.text((x + 6, y + 6), f"ERROR: {exc}", fill="red", font=font)
            label = path.name
            draw.text((x + 6, y + thumb_h - 23), label[:30], fill="black", font=font)
        sheet.save(folder_out / f"page_{page:03d}.jpg", quality=90)
    print(folder_name, len(files), "images", "->", folder_out)
