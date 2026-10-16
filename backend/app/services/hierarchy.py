"""Subcategoría y estado del coral sobre la categoría mayor ya predicha.

Los modelos vienen del proyecto de tesis (esquema cobertura_codes_v3) y sus
etiquetas no coinciden con las 6 clases de la app, así que aquí se traduce:

- species:   "CATEGORIA/SUBCATEGORIA" (p. ej. "CORAL/POCILLOPORA_SPP"); solo se
             consideran las subcategorías de la categoría mayor del punto
             (máscara + renormalización), así nunca sale "Coral" con una
             subcategoría de algas.
- condition: "CORAL_SANO" / "CORAL_BLANQUEADO" / "CORAL_RECIEN_MUERTO"; solo se
             corre sobre puntos cuya categoría mayor es Coral.
"""
from ..core.config import SUBCATEGORY_MODEL_ID, CONDITION_MODEL_ID
from .inference import predict_probs
from .model_loader import load_labeled_model, model_available

# clase de la app -> prefijo de categoría en el esquema v3
MAJOR_TO_V3 = {
    "Algas": "ALGAS",
    "Coral": "CORAL",
    "Otros organismos": "OTROS_ORGANISMOS",
    "Sustrato inerte": "SUSTRATO_INERTE",
    "Tape": "TAPE",
}

# etiqueta del modelo de estado -> código de condición v3 (el que usa la UI/Excel)
CONDITION_TO_CODE = {
    "CORAL_SANO": "SANO",
    "CORAL_BLANQUEADO": "BLAN",
    "CORAL_RECIEN_MUERTO": "DCOR",
}

CONDITION_CLASS = "Coral"


def availability() -> dict:
    return {
        "subcategory": model_available(SUBCATEGORY_MODEL_ID),
        "condition": model_available(CONDITION_MODEL_ID),
    }


def _pretty_subcategory(code: str) -> str:
    # "POCILLOPORA_SPP" -> "Pocillopora spp"
    return code.replace("_", " ").strip().capitalize()


def _subcategory_index(labels):
    """{prefijo v3: [(idx, nombre_subcategoria), ...]} solo para etiquetas con '/'."""
    by_major = {}
    for i, lab in enumerate(labels):
        if "/" in lab:
            major, sub = lab.split("/", 1)
            by_major.setdefault(major, []).append((i, sub))
    return by_major


def add_subcategories(img, points):
    model, tfm, labels, patch_size = load_labeled_model(SUBCATEGORY_MODEL_ID)
    by_major = _subcategory_index(labels)

    targets = [p for p in points if by_major.get(MAJOR_TO_V3.get(p.get("pred_label")))]
    if not targets:
        return
    probs = predict_probs(img, targets, model, tfm, patch_size)

    for p, row in zip(targets, probs):
        options = by_major[MAJOR_TO_V3[p["pred_label"]]]
        idxs = [i for i, _ in options]
        sub_probs = row[idxs]
        total = float(sub_probs.sum())
        best = int(sub_probs.argmax())
        p["subcategory"] = _pretty_subcategory(options[best][1])
        # P(subcategoría | categoría mayor): probabilidad renormalizada dentro de la máscara
        p["subcategory_confidence"] = float(sub_probs[best]) / total if total > 0 else None


def add_conditions(img, points):
    model, tfm, labels, patch_size = load_labeled_model(CONDITION_MODEL_ID)

    targets = [p for p in points if p.get("pred_label") == CONDITION_CLASS]
    if not targets:
        return
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
