import io, json, base64
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

from ...core.config import CLASSES
from ...services.model_loader import load_model_by_id
from ...services.points import generate_random_points, normalize_manual_points
from ...services.inference import predict_points_batch
from ...services.draw import draw_points

router = APIRouter()

@router.post("/process")
async def process(
    file: UploadFile = File(...),
    n: int = Form(100),
    model_id: str = Form(""),
    points_json: str = Form("")
):
    if not model_id:
        return JSONResponse({"error": "Selecciona un modelo"}, status_code=400)

    content = await file.read()
    img = Image.open(io.BytesIO(content)).convert("RGB")
    w, h = img.size

    model, tfm = load_model_by_id(model_id)

    if points_json:
        try:
            points = json.loads(points_json)
        except Exception:
            return JSONResponse({"error": "points_json inválido"}, status_code=400)
        points = normalize_manual_points(points, w, h)
    else:
        points = generate_random_points(w, h, n=n)

    pred_idxs, confs = predict_points_batch(img, points, model, tfm)
    for p, idx, conf in zip(points, pred_idxs, confs):
        p["pred_label"] = CLASSES[int(idx)]
        p["confidence"] = float(conf)
        p.setdefault("source", "modelo")

    annotated = draw_points(img, points)

    buffer = io.BytesIO()
    annotated.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {"annotated_image_base64": img_base64, "points": points}