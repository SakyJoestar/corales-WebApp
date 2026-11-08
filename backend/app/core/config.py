import os
import torch

CLASSES = ["Algas", "Coral", "Otros organismos", "Sustrato inerte", "Tape", "nan"]
NUM_CLASSES = len(CLASSES)

MAX_BATCH_IMAGES = 25
DEFAULT_N_POINTS = 100
POINTS_CHUNK_SIZE = 256  # inference done in chunks so a client cancel is noticed mid-image

# Modelos de la tesis (esquema jerárquico, modelos finales del 2026-11-07). Cada carpeta,
# en models_store/ o en el Hub, tiene best_model.pt + label_map.json + meta.json (con el
# tamaño de recorte de su nivel).
HIERARCHICAL_MODEL_ID = "n1_mobilenet_v2"          # categoría mayor, 5 clases, recorte 224
# subcategoría: un modelo por categoría mayor (clase de la app -> id del modelo)
SUBCATEGORY_MODEL_IDS = {
    "Coral": "n2_coral_mobilenet_v2",              # recorte 224
    "Algas": "n2_algas_mobilenet_v2",              # recorte 96
    "Sustrato inerte": "n2_sustrato_mobilenet_v2", # recorte 224
}
CONDITION_MODEL_ID = "n3_condicion_mobilenet_v2"   # sano / blanqueado, recorte 128

# etiqueta del entrenamiento -> nombre en la app
HIERARCHICAL_LABELS = {
    "ALGAS": "Algas",
    "CORAL": "Coral",
    "SUSTRATO_INERTE": "Sustrato inerte",
    "TAPE": "Tape",
    "NO_IDENTIFICADO_U_OTROS": "No identificado u otros",
}

# Threads CPU
try:
    torch.set_num_threads(4)
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/app/core -> backend/app
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))  # backend/app -> repo root
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
MODELS_DIR = os.path.join(BASE_DIR, "models_store")

os.makedirs(FRONTEND_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)