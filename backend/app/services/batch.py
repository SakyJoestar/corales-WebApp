import io, os, zipfile
from datetime import datetime
from openpyxl import Workbook
from PIL import Image

from ..core.config import CLASSES
from ..utils.naming import safe_filename, safe_sheet_name
from .points import generate_random_points
from .inference import predict_points_batch
from .draw import draw_points
from .excel import add_points_to_sheet

async def process_batch_zip(files, n: int, model_id: str, model, tfm) -> tuple[io.BytesIO, str]:
    wb = Workbook()
    default_ws = wb.active
    wb.remove(default_ws)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        used_sheet_names = set()

        for i, uf in enumerate(files, start=1):
            raw = await uf.read()
            try:
                img = Image.open(io.BytesIO(raw)).convert("RGB")
            except Exception:
                continue

            w, h = img.size
            points = generate_random_points(w, h, n=n)

            pred_idxs, confs = predict_points_batch(img, points, model, tfm)
            for p, idx, conf in zip(points, pred_idxs, confs):
                p["pred_label"] = CLASSES[int(idx)]
                p["confidence"] = float(conf)
                p["source"] = "modelo"

            annotated = draw_points(img, points)

            original_name = safe_filename(uf.filename or f"imagen_{i}.png")
            base = os.path.splitext(original_name)[0]
            out_png_name = f"{base} (anotada).png"

            img_bytes = io.BytesIO()
            annotated.save(img_bytes, format="PNG")
            zf.writestr(f"imagenes_anotadas/{out_png_name}", img_bytes.getvalue())

            sheet_name = safe_sheet_name(base)
            if sheet_name in used_sheet_names:
                k = 2
                while safe_sheet_name(f"{sheet_name}_{k}") in used_sheet_names:
                    k += 1
                sheet_name = safe_sheet_name(f"{sheet_name}_{k}")
            used_sheet_names.add(sheet_name)

            ws = wb.create_sheet(title=sheet_name)
            add_points_to_sheet(ws, original_name, model_id, points)

        xlsx_buf = io.BytesIO()
        wb.save(xlsx_buf)
        zf.writestr("tabla_puntos.xlsx", xlsx_buf.getvalue())

    zip_buf.seek(0)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"resultados_coral_{ts}.zip"
    return zip_buf, filename