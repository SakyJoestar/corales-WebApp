import os, json
import torch
import torch.nn as nn
from torchvision import models, transforms
from ..core.config import MODELS_DIR, NUM_CLASSES

_MODEL_CACHE = {}  # model_id -> (model, tfm)

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
    cached = _MODEL_CACHE.get(model_id)
    if cached is not None:
        return cached

    model_dir = os.path.join(MODELS_DIR, model_id)
    meta_path = os.path.join(model_dir, "meta.json")
    pt_path = os.path.join(model_dir, "best_model.pt")

    if not os.path.isfile(meta_path) or not os.path.isfile(pt_path):
        raise FileNotFoundError(f"Modelo '{model_id}' no encontrado")

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