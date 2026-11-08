from fastapi import APIRouter
from ...core.config import CLASSES, HIERARCHICAL_MODEL_ID, HIERARCHICAL_LABELS
from ...services.hierarchy import availability
from ...services.model_loader import model_available

router = APIRouter()

# El primero es el que la interfaz selecciona por defecto.
# hierarchical=True: modelo final de la tesis (N1 de 5 clases, recorte 224); el resto son la línea base
# (6 clases del esquema v2, recorte 32), que se dejan para comparar.
AVAILABLE_MODELS = [
    {
        "id": HIERARCHICAL_MODEL_ID,
        "model_name": "MobileNetV2 jerárquico (tesis)",
        "hierarchical": True,
        "classes": list(HIERARCHICAL_LABELS.values()),
    },
    {"id": "alexnet", "model_name": "AlexNet (línea base)", "hierarchical": False, "classes": CLASSES},
    {"id": "resnet", "model_name": "ResNet18 (línea base)", "hierarchical": False, "classes": CLASSES},
    {"id": "vgg16", "model_name": "VGG16 (línea base)", "hierarchical": False, "classes": CLASSES},
    {"id": "mobilenet_v2", "model_name": "MobileNetV2 (línea base)", "hierarchical": False, "classes": CLASSES},
]

MODELS_BY_ID = {m["id"]: m for m in AVAILABLE_MODELS}


def is_hierarchical(model_id: str) -> bool:
    return bool(MODELS_BY_ID.get(model_id, {}).get("hierarchical"))


@router.get("/models")
def list_models():
    items = []
    for m in AVAILABLE_MODELS:
        # la línea base se asume en el Hub; el modelo de la tesis solo se ofrece si está
        if m["hierarchical"] and not model_available(m["id"]):
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
