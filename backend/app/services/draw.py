from PIL import Image, ImageDraw, ImageFont

def _load_font(font_size: int):
    for fp in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]:
        try:
            return ImageFont.truetype(fp, font_size)
        except Exception:
            pass
    return ImageFont.load_default()

def draw_points(img: Image.Image, points):
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)

    W, H = out.size
    cross_size = max(10, int(min(W, H) * 0.020))
    half = cross_size // 2
    font_size = max(14, int(min(W, H) * 0.020))
    font = _load_font(font_size)

    color = (255, 0, 0)
    width = 2

    for p in points:
        x, y = int(p["x"]), int(p["y"])
        label = p.get("label", "")

        draw.line((x - half, y, x + half, y), fill=color, width=width)
        draw.line((x, y - half, x, y + half), fill=color, width=width)

        tx, ty = x + half + 4, y - half - 2
        draw.text((tx, ty), label, fill=color, font=font)

    return out