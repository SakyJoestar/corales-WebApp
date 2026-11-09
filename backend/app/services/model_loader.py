import os, json
from functools import lru_cache

import torch
import torch.nn as nn
from torchvision import models, transforms

from huggingface_hub import hf_hub_download, file_exists

from ..core.config import CLASSES, NUM_CLASSES, MODELS_DIR, HIERARCHICAL_LABELS, N1_MODEL_IDS

HF_REPO_ID = "SamuelGal/coral-models"

_MODEL_CACHE = {}  # model_id -> (model, tfm, classes, patch_size)

# Modelos de la línea base: 6 clases (esquema v2), entrenados con recortes de 32 px.
BASELINE_PATCH_SIZE = 32


def build_model(arch: str, num_classes: int):
    arch = arch.lower().replace("-", "").replace("_", "")

    if arch == "vgg16":
        m = models.vgg16(weights=None)
        m.classifier[6] = nn.Linear(m.classifier[6].in_features, num_classes)
        return m

    if arch in ("resnet18", "resnet"):  # el meta.json del Hub dice "resnet"; los pesos son de ResNet18
        m = models.resnet18(weights=None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
        return m

    if arch == "alexnet":
        m = models.alexnet(weights=None)
        m.classifier[6] = nn.Linear(m.classifier[6].in_features, num_classes)
        return m

    if arch == "resnet50":
        m = models.resnet50(weights=None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
        return m

    if arch == "efficientnetb0":
        m = models.efficientnet_b0(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
        return m

    if arch == "mobilenetv2":
        m = models.mobilenet_v2(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
        return m

    raise ValueError(f"Arquitectura no soportada: {arch}")


def _eval_transform():
    # Igual que la evaluación del entrenamiento: el recorte se lleva a 224 y se normaliza con ImageNet.
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])


def _local_path(model_id: str, filename: str):
    path = os.path.join(MODELS_DIR, model_id, filename)
    return path if os.path.isfile(path) else None


def _download_from_hub(model_id: str, filename: str) -> str:
    """Descarga {model_id}/{filename} del repo HF_REPO_ID y devuelve la ruta del archivo en caché."""
    return hf_hub_download(repo_id=HF_REPO_ID, filename=f"{model_id}/{filename}")


def _resolve(model_id: str, filename: str) -> str:
    """Primero models_store/{model_id}/{filename} (pruebas locales), si no el Hub."""
    return _local_path(model_id, filename) or _download_from_hub(model_id, filename)


@lru_cache(maxsize=None)
def _on_hub(model_id: str) -> bool:
    try:
        return file_exists(HF_REPO_ID, f"{model_id}/best_model.pt") and \
            file_exists(HF_REPO_ID, f"{model_id}/label_map.json")
    except Exception:
        return False


def model_available(model_id: str) -> bool:
    """Un modelo de la tesis está disponible si está en models_store/ o en el Hub."""
    local = _local_path(model_id, "best_model.pt") and _local_path(model_id, "label_map.json")
    return bool(local) or _on_hub(model_id)


def load_labeled_model(model_id: str):
    """Modelo con su propio label_map.json (los de la tesis).

    Devuelve (model, tfm, labels, patch_size). Cada nivel se entrenó con su propio
    tamaño de recorte (224, 96 o 128 px), que viaja en meta.json.
    """
    key = ("labeled", model_id)
    cached = _MODEL_CACHE.get(key)
    if cached is not None:
        return cached

    with open(_resolve(model_id, "meta.json"), "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(_resolve(model_id, "label_map.json"), "r", encoding="utf-8") as f:
        label_map = json.load(f)
    labels = [label_map[str(i)] for i in range(len(label_map))]

    model = build_model(meta.get("model_name", model_id), len(labels))
    model.load_state_dict(torch.load(_resolve(model_id, "best_model.pt"), map_location="cpu"))
    model.eval()

    result = (model, _eval_transform(), labels, int(meta.get("patch_size", 224)))
    _MODEL_CACHE[key] = result
    return result


def load_major_model(model_id: str):
    """Modelo de categoría mayor. Devuelve (model, tfm, classes, patch_size).

    - N1_MODEL_IDS: N1 de la tesis (5 clases, recorte 224) con MobileNetV2 y las otras
      arquitecturas; las clases se traducen a los nombres de la app con HIERARCHICAL_LABELS.
    - si no: modelos de la línea base (6 clases de CLASSES, recorte 32). Salen siempre del
      Hub: models_store/ tiene copias viejas (AlexNet/, vgg16/...) que en Windows
      coincidirían por mayúsculas.
    """
    if model_id in N1_MODEL_IDS:
        model, tfm, labels, patch_size = load_labeled_model(model_id)
        return model, tfm, [HIERARCHICAL_LABELS.get(l, l) for l in labels], patch_size

    cached = _MODEL_CACHE.get(model_id)
    if cached is not None:
        return cached

    with open(_download_from_hub(model_id, "meta.json"), "r", encoding="utf-8") as f:
        meta = json.load(f)
    model = build_model(meta.get("model_name", model_id), NUM_CLASSES)
    model.load_state_dict(torch.load(_download_from_hub(model_id, "best_model.pt"), map_location="cpu"))
    model.eval()

    result = (model, _eval_transform(), CLASSES, BASELINE_PATCH_SIZE)
    _MODEL_CACHE[model_id] = result
    return result
