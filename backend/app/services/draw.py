# draw.py
from __future__ import annotations
from typing import Any, Dict, List
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_font(font_size: int) -> ImageFont.ImageFont:
    candidates = [
        "DejaVuSans-Bold.ttf",
        "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]

    for fp in candidates:
        try:
            # si es ruta absoluta, verificar existencia
            if ("/" in fp or "\\" in fp) and not os.path.isfile(fp):
                continue
            f = ImageFont.truetype(fp, font_size)
            print("FONT OK:", fp, "size:", font_size)
            return f
        except Exception:
            continue

    print("FONT FALLBACK: load_default() (THIS WILL BE TINY)")
    return ImageFont.load_default()


def draw_points(
    img: Image.Image,
    points: List[Dict[str, Any]],
    color=(255, 0, 0),
) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)

    print(">>> draw.py VERSION = 2026-02-23 FONT DEBUG")

    W, H = out.size
    s = min(W, H)

    cross_size = max(16, int(s * 0.030))   # antes 0.020
    half = cross_size // 2

    font_size  = max(28, int(s * 0.038))
    font = _load_font(font_size)

    width = 4

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