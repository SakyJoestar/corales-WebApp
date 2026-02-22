import os, json
from fastapi import APIRouter
from ...core.config import MODELS_DIR, CLASSES, NUM_CLASSES

router = APIRouter()

@router.get("/models")
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