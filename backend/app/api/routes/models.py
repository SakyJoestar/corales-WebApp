from fastapi import APIRouter
from ...core.config import HIERARCHICAL_MODEL_ID, HIERARCHICAL_LABELS
from ...services.hierarchy import availability
from ...services.model_loader import model_available

router = APIRouter()

# El primero es el que la interfaz selecciona por defecto. Todos son el N1 de la tesis
# (5 clases, recorte 224); la subcategoría y el estado salen siempre de los MobileNetV2 finales.
# MobileNetV2 es el modelo final (todas las fotos); los demás son el modelo de una partición
# de la comparación de arquitecturas (meta.json del Hub dice cuál).
_N1_CLASSES = list(HIERARCHICAL_LABELS.values())
AVAILABLE_MODELS = [
    {"id": HIERARCHICAL_MODEL_ID, "model_name": "MobileNetV2 (recomendado)", "hierarchical": True, "classes": _N1_CLASSES},
    {"id": "n1_efficientnet_b0", "model_name": "EfficientNet-B0", "hierarchical": True, "classes": _N1_CLASSES},
    {"id": "n1_resnet50", "model_name": "ResNet50", "hierarchical": True, "classes": _N1_CLASSES},
    {"id": "n1_alexnet", "model_name": "AlexNet", "hierarchical": True, "classes": _N1_CLASSES},
]

MODELS_BY_ID = {m["id"]: m for m in AVAILABLE_MODELS}


def is_hierarchical(model_id: str) -> bool:
    return bool(MODELS_BY_ID.get(model_id, {}).get("hierarchical"))


@router.get("/models")
def list_models():
    items = []
    for m in AVAILABLE_MODELS:
        # solo se ofrecen los modelos que están en models_store/ o en el Hub
        if not model_available(m["id"]):
            continue
        items.append({
            "id": m["id"],
            "model_name": m["model_name"],
            "classes": m["classes"],
            "num_classes": len(m["classes"]),
            "has_weights": True,
        })

    # qué niveles extra se pueden predecir (si no, la UI los deja para llenado manual)
    return {"models": items, "hierarchy": availability()}
