import os, json
import torch
import torch.nn as nn
from torchvision import models, transforms

from huggingface_hub import hf_hub_download

from ..core.config import NUM_CLASSES, MODELS_DIR

# Cambia esto por tu repo real
HF_REPO_ID = "SamuelGal/coral-models"

_MODEL_CACHE = {}  # model_id -> (model, tfm)

def build_model(arch: str, num_classes: int):
    arch = arch.lower().replace("-", "").replace("_", "")

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

    if arch == "mobilenetv2":
        m = models.mobilenet_v2(weights=None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
        return m

    raise ValueError(f"Arquitectura no soportada: {arch}")

def _local_path(model_id: str, filename: str):
    path = os.path.join(MODELS_DIR, model_id, filename)
    return path if os.path.isfile(path) else None

def _resolve(model_id: str, filename: str) -> str:
    """Primero models_store/{model_id}/{filename} (pruebas locales), si no el Hub."""
    return _local_path(model_id, filename) or _download_from_hub(model_id, filename)

def model_available(model_id: str) -> bool:
    """Para modelos opcionales (subcategoría/estado): solo se consideran si están en local."""
    return _local_path(model_id, "best_model.pt") is not None and         _local_path(model_id, "label_map.json") is not None

def _download_from_hub(model_id: str, filename: str) -> str:
    """
    Descarga un archivo del repo HF_REPO_ID con path: {model_id}/{filename}
    Devuelve la ruta local al archivo cacheado.
    """
    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=f"{model_id}/{filename}",
    )

def load_model_by_id(model_id: str):
    cached = _MODEL_CACHE.get(model_id)
    if cached is not None:
        return cached

    # Descarga meta.json y best_model.pt desde el Hub
    # El modelo mayor sale siempre del Hub: models_store/ tiene copias viejas
    # (AlexNet/, vgg16/...) que en Windows coincidirían por mayúsculas.
    meta_path = _download_from_hub(model_id, "meta.json")
    pt_path = _download_from_hub(model_id, "best_model.pt")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    arch = meta.get("model_name", model_id)
    model = build_model(arch, NUM_CLASSES)

    state = torch.load(pt_path, map_location="cpu")
    model.load_state_dict(state)
    model.eval()

    tfm = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    _MODEL_CACHE[model_id] = (model, tfm)
    return model, tfm

def load_labeled_model(model_id: str):
    """Modelo con su propio label_map.json (p. ej. subcategoría o estado).

    Devuelve (model, tfm, labels, patch_size). Los modelos de la tesis se
    entrenaron con recortes de 224 px, distinto del modelo mayor (32 px), así
    que el tamaño de recorte viaja en meta.json.
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

    tfm = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    result = (model, tfm, labels, int(meta.get("patch_size", 224)))
    _MODEL_CACHE[key] = result
    return result
