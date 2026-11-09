# draw.py
from __future__ import annotations
from typing import Any, Dict, List
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Debe reflejar frontend/js/classColors.js (CLASS_COLOR_HEX) para que
# la cruz sobre la imagen y la leyenda/tabla del frontend usen el mismo color por clase.
CLASS_COLOR_RGB = {
    "Algas": (27, 175, 122),
    "Coral": (235, 104, 52),
    "Otros organismos": (74, 58, 167),
    "No identificado u otros": (74, 58, 167),  # N1 de la tesis: no identificado + otros organismos
    "Sustrato inerte": (42, 120, 214),
    "Tape": (201, 151, 46),
    "nan": (143, 128, 115),
}

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

    print("FONT FALLBACK: load_default(size=...) (Pillow >= 10.1 escala este tamaño)")
    return ImageFont.load_default(size=font_size)


def draw_points(
    img: Image.Image,
    points: List[Dict[str, Any]],
    color=(255, 0, 0),
) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)

    W, H = out.size
    s = min(W, H)

    # Tamaños relativos al lado menor de la foto (los mismos que el marcado manual del
    # frontend, render.js): anillo hueco del color de la clase con contorno negro, un punto
    # central para ver dónde cae exactamente y el ID con contorno negro para leerlo sobre
    # cualquier fondo.
    radius = max(6, int(s * 0.009))
    ring_width = max(2, int(s * 0.0024))
    outline = max(1, ring_width // 2)
    dot = max(2, int(s * 0.0012))

    font_size = max(26, int(s * 0.034))
    stroke = max(2, font_size // 14)
    font = _load_font(font_size)

    for p in points:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        label = str(p.get("label", "") or "")
        p_color = CLASS_COLOR_RGB.get(p.get("pred_label"), color)

        r_out = radius + outline
        draw.ellipse((x - r_out, y - r_out, x + r_out, y + r_out),
                     outline=(0, 0, 0), width=ring_width + 2 * outline)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius),
                     outline=p_color, width=ring_width)
        draw.ellipse((x - dot - outline, y - dot - outline, x + dot + outline, y + dot + outline),
                     fill=(0, 0, 0))
        draw.ellipse((x - dot, y - dot, x + dot, y + dot), fill=p_color)

        tx = x + r_out + stroke + 4
        ty = y - (font_size // 2)
        draw.text((tx, ty), label, fill=p_color, font=font,
                  stroke_width=stroke, stroke_fill=(0, 0, 0))

    return out