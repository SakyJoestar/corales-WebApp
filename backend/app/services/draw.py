from PIL import ImageDraw, ImageFont
from pathlib import Path

def _pick_sizes(img_w: int, img_h: int):
    # referencia: el lado menor de la imagen
    s = min(img_w, img_h)

    # cruz: entre 10 y 40 px según tamaño
    cross = max(10, min(40, s // 40))          # ej: 1200px -> 30
    # grosor de línea: 2 a 6
    thick = max(2, min(6, s // 300))           # ej: 1200px -> 4
    # fuente: 14 a 48
    fsize = max(14, min(48, s // 35))          # ej: 1200px -> 34
    return cross, thick, fsize


def draw_points(img, points, color=(255, 0, 0)):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    cross, thick, fsize = _pick_sizes(w, h)

    # Intenta usar una fuente TTF (mejor que la default)
    font = None
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if Path(p).exists():
            font = ImageFont.truetype(p, fsize)
            break
    if font is None:
        font = ImageFont.load_default()  # fallback

    for p in points:
        x, y = int(p["x"]), int(p["y"])
        label = p.get("pred", p.get("label", ""))  # ajusta según tu estructura

        # Cruz
        draw.line([(x - cross, y), (x + cross, y)], fill=color, width=thick)
        draw.line([(x, y - cross), (x, y + cross)], fill=color, width=thick)

        # Texto con borde para que se lea sobre fondos complejos
        tx, ty = x + cross + 4, y - fsize // 2
        draw.text(
            (tx, ty),
            label,
            fill=color,
            font=font,
            stroke_width=max(1, thick),      # borde
            stroke_fill=(0, 0, 0)            # borde negro
        )

    return img