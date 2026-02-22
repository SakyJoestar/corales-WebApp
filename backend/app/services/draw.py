from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont


def _pick_sizes(w: int, h: int) -> Tuple[int, int, int]:
    """
    cross_len, line_width, font_size
    Ajustado para verse como tu ejemplo.
    """
    s = min(w, h)

    cross_len = max(16, min(70, s // 28))   # tamaño de la cruz
    line_w = max(3, min(12, s // 220))      # grosor
    font_size = max(28, min(110, s // 16))  # 👈 letra grande

    return cross_len, line_w, font_size


def _get_font(font_size: int) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, font_size)
    return ImageFont.load_default()


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def draw_points(
    img: Image.Image,
    points: List[Dict[str, Any]],
    cross_color=(255, 0, 0),
) -> Image.Image:
    """
    Dibuja cruz roja + LETRA (A,B,C...) grande al lado.
    Usa EXCLUSIVAMENTE p["label"] (la que ya generas en points.py).
    """
    if img.mode != "RGB":
        img = img.convert("RGB")

    draw = ImageDraw.Draw(img)
    w, h = img.size

    cross_len, line_w, font_size = _pick_sizes(w, h)
    font = _get_font(font_size)

    for p in points:
        x = int(round(float(p.get("x", 0))))
        y = int(round(float(p.get("y", 0))))

        x = _clamp(x, 0, w - 1)
        y = _clamp(y, 0, h - 1)

        # Cruz
        draw.line([(x - cross_len, y), (x + cross_len, y)], fill=cross_color, width=line_w)
        draw.line([(x, y - cross_len), (x, y + cross_len)], fill=cross_color, width=line_w)

        # Letra EXACTA de la tabla (A, B, C...)
        letter = str(p.get("label", "")).strip()
        if not letter:
            # fallback por si algo raro llega sin label
            letter = "?"

        # Posición: arriba-derecha de la cruz (como suele usarse)
        tx = x + cross_len + 8
        ty = y - font_size  # arriba un poco

        # Si se sale por la derecha, ponlo a la izquierda
        if tx > w - (font_size * 2):
            tx = x - cross_len - 8 - (font_size * 2)

        tx = _clamp(int(tx), 0, w - 1)
        ty = _clamp(int(ty), 0, h - 1)

        # Letra en ROJO con borde negro (para que se lea siempre)
        draw.text(
            (tx, ty),
            letter,
            font=font,
            fill=cross_color,
            stroke_width=max(2, line_w),
            stroke_fill=(0, 0, 0),
        )

    return img