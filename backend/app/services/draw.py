from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

from PIL import Image, ImageDraw, ImageFont


def _pick_sizes(w: int, h: int) -> Tuple[int, int, int, int]:
    """
    Devuelve: cross_len, line_width, font_size, padding
    Escala según el lado menor de la imagen.
    """
    s = min(w, h)

    # Cruces bien visibles
    cross_len = max(16, min(70, s // 28))
    line_w = max(3, min(12, s // 220))

    # Letras grandes
    font_size = max(26, min(96, s // 18))

    # Padding para el fondo del texto
    pad = max(3, min(14, s // 250))

    return cross_len, line_w, font_size, pad


def _get_font(font_size: int) -> ImageFont.ImageFont:
    """
    Intenta cargar una fuente del sistema (Spaces suele tener DejaVu).
    """
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


def _text_bbox(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, xy: Tuple[int, int]):
    """
    bbox del texto. PIL moderno tiene textbbox.
    """
    if hasattr(draw, "textbbox"):
        return draw.textbbox(xy, text, font=font, stroke_width=0)
    # fallback
    tw, th = draw.textsize(text, font=font)  # type: ignore[attr-defined]
    x, y = xy
    return (x, y, x + tw, y + th)


def _label_from_point(p: Dict[str, Any], i: int, show_conf: bool) -> str:
    """
    TU CASO: la etiqueta viene en p["pred_label"].
    Fallback: muestra P{i} para no quedarse vacío.
    """
    label = None

    # Prioridad: lo que tú pones en processing.py
    if "pred_label" in p and str(p["pred_label"]).strip():
        label = str(p["pred_label"]).strip()

    # Fallbacks por si en otro lugar usas otros nombres
    if not label:
        for k in ("label", "class_name", "pred_class_name", "pred"):
            v = p.get(k)
            if v is not None and str(v).strip():
                label = str(v).strip()
                break

    if not label:
        label = f"P{i}"

    if show_conf:
        conf = p.get("confidence", None)
        try:
            if conf is not None:
                label = f"{label} ({float(conf):.2f})"
        except Exception:
            pass

    return label


def draw_points(
    img: Image.Image,
    points: List[Dict[str, Any]],
    cross_color: Tuple[int, int, int] = (255, 0, 0),
    text_color: Tuple[int, int, int] = (255, 255, 255),
    stroke_color: Tuple[int, int, int] = (0, 0, 0),
    show_confidence: bool = False,
    text_bg: bool = True,
) -> Image.Image:
    """
    Dibuja cruces + etiquetas grandes y legibles.
    Usa p["pred_label"] y p["confidence"] según tu pipeline actual.
    """
    if img.mode != "RGB":
        img = img.convert("RGB")

    draw = ImageDraw.Draw(img)
    w, h = img.size

    cross_len, line_w, font_size, pad = _pick_sizes(w, h)
    font = _get_font(font_size)

    for i, p in enumerate(points, start=1):
        # Coordenadas en pixeles (en tu pipeline points ya deberían estar en pixeles)
        x = int(round(float(p.get("x", 0))))
        y = int(round(float(p.get("y", 0))))

        x = _clamp(x, 0, w - 1)
        y = _clamp(y, 0, h - 1)

        # Cruz
        draw.line([(x - cross_len, y), (x + cross_len, y)], fill=cross_color, width=line_w)
        draw.line([(x, y - cross_len), (x, y + cross_len)], fill=cross_color, width=line_w)

        # Texto
        label = _label_from_point(p, i, show_confidence)

        # Posición por defecto: derecha
        tx = x + cross_len + 10
        ty = y - font_size // 2

        # Si está muy cerca del borde derecho, ponlo a la izquierda
        est_w = max(80, int(font_size * 3.4))
        if tx > w - est_w:
            tx = x - cross_len - 10 - est_w

        tx = _clamp(tx, 0, w - 1)
        ty = _clamp(ty, 0, h - 1)

        # Fondo para legibilidad
        if text_bg:
            x0, y0, x1, y1 = _text_bbox(draw, label, font, (tx, ty))
            x0 = _clamp(x0 - pad, 0, w - 1)
            y0 = _clamp(y0 - pad, 0, h - 1)
            x1 = _clamp(x1 + pad, 0, w - 1)
            y1 = _clamp(y1 + pad, 0, h - 1)
            draw.rectangle([x0, y0, x1, y1], fill=(0, 0, 0))

        # Texto con borde
        draw.text(
            (tx, ty),
            label,
            font=font,
            fill=text_color,
            stroke_width=max(2, line_w),
            stroke_fill=stroke_color,
        )

    return img