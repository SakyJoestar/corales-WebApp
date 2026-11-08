"""Subcategoría y estado del coral sobre la categoría mayor ya predicha.

Modelos finales de la tesis (esquema jerárquico, 2026-11-07):

- Subcategoría: un modelo por categoría mayor (coral, algas y sustrato inerte), cada uno
  con su recorte (224, 96 y 224 px). Solo se corre sobre los puntos de su categoría, así
  que nunca sale "Coral" con una subcategoría de algas. Tape y "No identificado u otros"
  no tienen subcategoría.
- Estado del coral: sano o blanqueado (recorte 128 px), solo sobre los puntos de Coral.

Sirve con el N1 de la tesis y con los modelos de la línea base, porque ambos usan los
nombres "Coral", "Algas" y "Sustrato inerte".
"""
from ..core.config import SUBCATEGORY_MODEL_IDS, CONDITION_MODEL_ID
from .inference import predict_probs
from .model_loader import load_labeled_model, model_available

# etiqueta del entrenamiento -> nombre en la app
SUBCATEGORY_NAMES = {
    "POCILLOPORA_SPP": "Pocillopora spp.",
    "PSAMMOCORA_STELLATA": "Psammocora stellata",
    "PAVONA_CLAVUS": "Pavona clavus",
    "OTROS_CORALES": "Otros corales",
    "TAPETES_FRONDOSA_O_FILAMENTOSA_1CM": "Tapetes",
    "CALCAREAS_INCRUSTANTES": "Calcáreas incrustantes",
    "OTRAS_ALGAS": "Otras algas",
    "SEDIMENTO_LIBRE": "Sedimento libre",
    "ROCA": "Roca",
    "OTRO_SUSTRATO": "Otro sustrato",
}

# etiqueta del modelo de estado -> código de condición v3 (el que usa la UI/Excel)
CONDITION_TO_CODE = {
    "CORAL_SANO": "SANO",
    "CORAL_BLANQUEADO": "BLAN",
}

CONDITION_CLASS = "Coral"


def availability() -> dict:
    return {
        # se ofrece si hay al menos un modelo de subcategoría; cada categoría usa el suyo si está
        "subcategory": any(model_available(m) for m in SUBCATEGORY_MODEL_IDS.values()),
        "condition": model_available(CONDITION_MODEL_ID),
    }


def add_subcategories(img, points):
    for major, model_id in SUBCATEGORY_MODEL_IDS.items():
        targets = [p for p in points if p.get("pred_label") == major]
        if not targets or not model_available(model_id):
            continue
        model, tfm, labels, patch_size = load_labeled_model(model_id)
        probs = predict_probs(img, targets, model, tfm, patch_size)
        for p, row in zip(targets, probs):
            best = int(row.argmax())
            p["subcategory"] = SUBCATEGORY_NAMES.get(labels[best], labels[best])
            p["subcategory_confidence"] = float(row[best])


def add_conditions(img, points):
    targets = [p for p in points if p.get("pred_label") == CONDITION_CLASS]
    if not targets:
        return
    model, tfm, labels, patch_size = load_labeled_model(CONDITION_MODEL_ID)
    probs = predict_probs(img, targets, model, tfm, patch_size)

    for p, row in zip(targets, probs):
        best = int(row.argmax())
        code = CONDITION_TO_CODE.get(labels[best])
        if code:
            p["condition"] = code
            p["condition_confidence"] = float(row[best])


def apply_hierarchy(img, points, include_subcategory: bool, include_condition: bool):
    """Corre solo lo pedido y disponible. La regla de la UI se respeta también aquí:
    el estado solo si también se pidió la subcategoría."""
    avail = availability()
    if include_subcategory and avail["subcategory"]:
        add_subcategories(img, points)
    if include_subcategory and include_condition and avail["condition"]:
        add_conditions(img, points)
