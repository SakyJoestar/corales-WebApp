import numpy as np
from ..core.config import CLASSES

def idx_to_label_excel(idx: int) -> str:
    label = ""
    while idx > 0:
        idx -= 1
        label = chr(ord("A") + (idx % 26)) + label
        idx //= 26
    return label

def generate_random_points(w: int, h: int, n: int, margin: int = 10):
    xs = np.random.randint(margin, max(margin + 1, w - margin), size=n)
    ys = np.random.randint(margin, max(margin + 1, h - margin), size=n)

    points = []
    for i, (x, y) in enumerate(zip(xs, ys), start=1):
        points.append({
            "idx": i,
            "label": idx_to_label_excel(i),
            "x": int(x),
            "y": int(y),
            "x_norm": float(x / w) if w else 0.0,
            "y_norm": float(y / h) if h else 0.0,
        })
    return points

def normalize_manual_points(points: list, w: int, h: int):
    # asegura idx/label/norm/source
    for i, p in enumerate(points, start=1):
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        p["idx"] = int(p.get("idx", i))
        p["label"] = p.get("label") or idx_to_label_excel(p["idx"])
        p["x"] = x
        p["y"] = y
        p["x_norm"] = float(x / w) if w else 0.0
        p["y_norm"] = float(y / h) if h else 0.0
        p["source"] = p.get("source", "manual")
    return points