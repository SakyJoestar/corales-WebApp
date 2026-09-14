import os, json
import torch
import torch.nn as nn
from torchvision import models, transforms

from huggingface_hub import hf_hub_download

from ..core.config import NUM_CLASSES

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