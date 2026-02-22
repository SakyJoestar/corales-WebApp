from fastapi import APIRouter
from ...core.config import CLASSES, NUM_CLASSES

router = APIRouter()

# Define aquí los modelos que tienes en el Hub
AVAILABLE_MODELS = [
    {
        "id": "alexnet",
        "model_name": "AlexNet"
    },
    {
        "id": "resnet18",
        "model_name": "ResNet18"
    },
    {
        "id": "vgg16",
        "model_name": "VGG16"
    },
    {
        "id": "mobilenet_v2",
        "model_name": "MobileNetV2"
    }
]

@router.get("/models")
def list_models():
    items = []

    for m in AVAILABLE_MODELS:
        item = {
            "id": m["id"],
            "model_name": m["model_name"],
            "classes": CLASSES,
            "num_classes": NUM_CLASSES,
            "has_weights": True  # asumimos que existen en el Hub
        }
        items.append(item)

    return {"models": items}