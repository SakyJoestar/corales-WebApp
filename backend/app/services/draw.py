from PIL import ImageDraw, ImageFont
from pathlib import Path

def _pick_sizes(img_w: int, img_h: int):
    s = min(img_w, img_h)

    cross = max(15, min(50, s // 35))      # cruces más grandes
    thick = max(3, min(8, s // 250))       # líneas más gruesas
    fsize = max(24, min(72, s // 25))      # 👈 LETRA GRANDE

    return cross, thick, fsize


def draw_points(img, points, color=(255, 0, 0)):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    cross, thick, fsize = _pick_sizes(w, h)

    # Fuente real (no la default pequeña)
    font = None
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if Path(p).exists():
            font = ImageFont.truetype(p, fsize)
            break

    if font is None:
        font = ImageFont.load_default()

    for p in points:
        x, y = int(p["x"]), int(p["y"])
        label = p.get("pred", "")

        # Cruz grande
        draw.line([(x - cross, y), (x + cross, y)], fill=color, width=thick)
        draw.line([(x, y - cross), (x, y + cross)], fill=color, width=thick)

        # Texto con borde grueso
        tx = x + cross + 6
        ty = y - fsize // 2

        draw.text(
            (tx, ty),
            label,
            font=font,
            fill=color,
            stroke_width=max(2, thick),      # 👈 BORDE MÁS GRUESO
            stroke_fill=(0, 0, 0)
        )

    return img