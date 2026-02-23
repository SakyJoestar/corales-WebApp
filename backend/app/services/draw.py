# draw.py
from __future__ import annotations
from typing import Any, Dict, List
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_font(font_size: int) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for fp in candidates:
        if os.path.isfile(fp):
            return ImageFont.truetype(fp, font_size)
    return ImageFont.load_default()


def draw_points(
    img: Image.Image,
    points: List[Dict[str, Any]],
    color=(255, 0, 0),
) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)

    W, H = out.size
    s = min(W, H)

    cross_size = max(16, int(s * 0.030))   # antes 0.020
    half = cross_size // 2

    # 👇 letra más grande que la cruz (mantiene estilo, mejora legibilidad)
    font_size  = max(34, int(s * 0.045))   # antes 0.032
    font = _load_font(font_size)

    width = 3

    for p in points:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        label = str(p.get("label", "") or "")

        draw.line((x - half, y, x + half, y), fill=color, width=width)
        draw.line((x, y - half, x, y + half), fill=color, width=width)

        # offsets similares a tu estilo, ajustados a letra grande
        tx = x + half + 4
        ty = y - (font_size // 2)
        draw.text((tx, ty), label, fill=color, font=font)

    return out