import io, os, uuid, json
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import torch
import torch.nn as nn
from torchvision import models, transforms

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse


# ===================== CONFIG =====================

CLASSES = [
    "Algas",
    "Coral",
    "Otros organismos",
    "Sustrato inerte",
    "Tape",
    "nan"
]
NUM_CLASSES = len(CLASSES)

# Ajusta si quieres más/menos hilos en CPU (4 suele ir bien)
try:
    torch.set_num_threads(4)
except Exception:
    pass

MODEL_CACHE = {}  # model_id -> (model, tfm)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE_DIR, "outputs")
STATIC_DIR = os.path.join(BASE_DIR, "static")
MODELS_DIR = os.path.join(BASE_DIR, "models_store")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

app = FastAPI()


# ===================== UTIL: LABELS A..Z, AA.. =====================

def idx_to_label_excel(idx: int) -> str:
    """
    1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA, 28 -> AB, ...
    """
    label = ""
    while idx > 0:
        idx -= 1
        label = chr(ord("A") + (idx % 26)) + label
        idx //= 26
    return label


# ===================== POINTS =====================

def generate_random_points(w: int, h: int, n: int, margin: int = 10):
    xs = np.random.randint(margin, max(margin + 1, w - margin), size=n)
    ys = np.random.randint(margin, max(margin + 1, h - margin), size=n)

    points = []
    for i, (x, y) in enumerate(zip(xs, ys), start=1):
        points.append({
            "idx": i,
            "label": idx_to_label_excel(i),  # ✅ coincide con la imagen
            "x": int(x),
            "y": int(y),
            "x_norm": float(x / w),
            "y_norm": float(y / h),
        })
    return points


# ===================== DRAW =====================

def _load_font(font_size: int):
    for fp in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
        "/Library/Fonts/Arial.ttf",                         # macOS
        "C:\\Windows\\Fonts\\arial.ttf"                     # Windows
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
        x, y = p["x"], p["y"]
        label = p.get("label", "")

        # "+"
        draw.line((x - half, y, x + half, y), fill=color, width=width)
        draw.line((x, y - half, x, y + half), fill=color, width=width)

        # texto al lado
        tx, ty = x + half + 4, y - half - 2
        draw.text((tx, ty), label, fill=color, font=font)

    return out


# ===================== MODEL LOADING =====================

def build_model(arch: str, num_classes: int):
    arch = arch.lower()
    if arch == "vgg16":
        m = models.vgg16(weights=None)
        m.classifier[6] = nn.Linear(m.classifier[6].in_features, num_classes)
        return m
    if arch == "resnet18":
        m = models.resnet18(weights=None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
        return m
    if arch == "alexnet":
        m = models.alexnet(weights=None)
        m.classifier[6] = nn.Linear(m.classifier[6].in_features, num_classes)
        return m
    if arch == "mobilenet_v2":
        m = models.mobilenet_v2(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
        return m

    raise ValueError(f"Arquitectura no soportada: {arch}")


def load_model_by_id(model_id: str):
    cached = MODEL_CACHE.get(model_id)
    if cached is not None:
        return cached  # (model, tfm)

    model_dir = os.path.join(MODELS_DIR, model_id)
    meta_path = os.path.join(model_dir, "meta.json")
    pt_path = os.path.join(model_dir, "best_model.pt")

    if not os.path.isfile(meta_path) or not os.path.isfile(pt_path):
        raise FileNotFoundError(f"Modelo '{model_id}' no encontrado o incompleto")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    arch = meta.get("model_name", model_id)
    model = build_model(arch, NUM_CLASSES)

    state = torch.load(pt_path, map_location="cpu")  # tu best_state (state_dict)
    model.load_state_dict(state)
    model.eval()
    model.to("cpu")

    tfm = transforms.Compose([
        transforms.Resize((224, 224)),  # tu entrenamiento usa 224
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    MODEL_CACHE[model_id] = (model, tfm)
    return model, tfm


# ===================== PATCH + BATCH PRED =====================

def crop_patch(img: Image.Image, x: int, y: int, size: int = 32) -> Image.Image:
    half = size // 2
    left, top = x - half, y - half
    right, bottom = x + half, y + half

    patch = Image.new("RGB", (size, size), (0, 0, 0))
    crop = img.crop((left, top, right, bottom))

    paste_x = max(0, -left)
    paste_y = max(0, -top)
    patch.paste(crop, (paste_x, paste_y))
    return patch


@torch.no_grad()
def predict_points_batch(img: Image.Image, points, model, tfm, patch_size: int = 32):
    patches = [tfm(crop_patch(img, p["x"], p["y"], size=patch_size)) for p in points]
    batch = torch.stack(patches, dim=0)  # [N,3,224,224]

    logits = model(batch)
    probs = torch.softmax(logits, dim=1)

    pred_idxs = probs.argmax(dim=1).cpu().numpy()
    confs = probs.max(dim=1).values.cpu().numpy()
    return pred_idxs, confs


# ===================== ROUTES =====================

@app.post("/process")
async def process(
    file: UploadFile = File(...),
    n: int = Form(100),
    model_id: str = Form("")
):
    if n < 1 or n > 5000:
        return JSONResponse({"error": "n fuera de rango (1..5000)"}, status_code=400)

    if not model_id:
        return JSONResponse({"error": "Selecciona un modelo"}, status_code=400)

    content = await file.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        return JSONResponse({"error": "Archivo no es una imagen válida"}, status_code=400)

    try:
        model, tfm = load_model_by_id(model_id)
    except Exception as e:
        return JSONResponse({"error": f"No pude cargar el modelo: {str(e)}"}, status_code=400)

    w, h = img.size
    points = generate_random_points(w, h, n=n, margin=10)

    # ✅ Batch inference (rápido)
    pred_idxs, confs = predict_points_batch(img, points, model=model, tfm=tfm, patch_size=32)

    for p, pred_idx, conf in zip(points, pred_idxs, confs):
        pred_idx = int(pred_idx)
        p["pred_idx"] = pred_idx
        p["pred_label"] = CLASSES[pred_idx]
        p["confidence"] = float(conf)

    annotated = draw_points(img, points)
    out_name = f"{uuid.uuid4().hex}.png"
    annotated.save(os.path.join(OUT_DIR, out_name), format="PNG")

    return {
        "annotated_image_url": f"/outputs/{out_name}",
        "points": points,
        "image_size": {"w": w, "h": h},
        "model_id_used": model_id
    }


@app.get("/models")
def list_models():
    items = []
    for folder in os.listdir(MODELS_DIR):
        folder_path = os.path.join(MODELS_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        meta_path = os.path.join(folder_path, "meta.json")
        pt_path = os.path.join(folder_path, "best_model.pt")
        if not os.path.isfile(meta_path):
            continue

        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

        meta.setdefault("id", folder)
        meta.setdefault("model_name", folder)

        meta["classes"] = CLASSES
        meta["num_classes"] = NUM_CLASSES
        meta["has_weights"] = os.path.isfile(pt_path)

        items.append(meta)

    items.sort(key=lambda x: x.get("id", ""))
    return {"models": items}


@app.get("/")
def home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/outputs", StaticFiles(directory=OUT_DIR), name="outputs")