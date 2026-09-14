import os
import torch

CLASSES = ["Algas", "Coral", "Otros organismos", "Sustrato inerte", "Tape", "nan"]
NUM_CLASSES = len(CLASSES)

MAX_BATCH_IMAGES = 25
DEFAULT_N_POINTS = 100

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