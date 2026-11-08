import io
from openpyxl import Workbook
from openpyxl.utils import get_column_letter


def infer_method(p: dict) -> str:
    method = (p.get("method") or "").strip().lower()
    if method == "manual":
        return "manual"
    if method == "automatico":
        return "automatico"

    source = (p.get("source") or "").strip().lower()
    if source.startswith("manual"):
        return "manual"

    return "automatico"


def _point_columns(include_subcategory: bool, include_condition: bool) -> list:
    """(encabezado, función que saca el valor del punto, ancho) en orden de columna."""
    cols = [
        ("idx", lambda p: p.get("idx"), 8),
        ("Etiqueta", lambda p: p.get("label"), 10),
        ("x", lambda p: p.get("x"), 10),
        ("y", lambda p: p.get("y"), 10),
        ("x_norm", lambda p: p.get("x_norm"), 14),
        ("y_norm", lambda p: p.get("y_norm"), 14),
        ("Predicción", lambda p: p.get("pred_label"), 20),
    ]
    if include_subcategory:
        cols.append(("Subcategoría", lambda p: p.get("subcategory"), 22))
        cols.append(("Conf. subcategoría", lambda p: p.get("subcategory_confidence"), 16))
    if include_condition:
        # código v3: SANO/BLAN/DCOR/FLUO/SICK/OTRO
        cols.append(("Estado coral", lambda p: p.get("condition"), 14))
        cols.append(("Conf. estado", lambda p: p.get("condition_confidence"), 12))
    cols += [
        ("Confianza", lambda p: p.get("confidence"), 14),
        ("Método", infer_method, 14),
        ("Nota", lambda p: p.get("note"), 24),
    ]
    return cols


def _write_points_sheet(ws, image_name: str, model_id: str, points: list,
                        include_subcategory: bool = True, include_condition: bool = True):
    # Encabezado como tu screenshot
    ws["A1"] = "imagen"
    ws["B1"] = image_name
    ws["A2"] = "modelo"
    ws["B2"] = model_id

    # El estado solo tiene sentido si también se pidió la subcategoría
    cols = _point_columns(include_subcategory, include_subcategory and include_condition)

    for c, (header, _, width) in enumerate(cols, start=1):
        ws.cell(row=4, column=c, value=header)
        ws.column_dimensions[get_column_letter(c)].width = width

    for r, p in enumerate(points, start=5):
        for c, (_, value_of, _) in enumerate(cols, start=1):
            ws.cell(r, c, value_of(p))


def export_single_excel(points: list, model_id: str, image_name: str,
                        include_subcategory: bool = True, include_condition: bool = True) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Puntos"

    _write_points_sheet(ws, image_name=image_name, model_id=model_id, points=points,
                        include_subcategory=include_subcategory, include_condition=include_condition)

    bio = io.BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio


def add_points_to_sheet(ws, image_name: str, model_id: str, points: list,
                        include_subcategory: bool = True, include_condition: bool = True):
    # Batch usa esta función por hoja
    _write_points_sheet(ws, image_name=image_name, model_id=model_id, points=points,
                        include_subcategory=include_subcategory, include_condition=include_condition)