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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/app -> backend
STATIC_DIR = os.path.join(BASE_DIR, "static")
MODELS_DIR = os.path.join(BASE_DIR, "models_store")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)