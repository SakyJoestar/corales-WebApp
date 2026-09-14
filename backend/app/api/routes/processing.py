import io, json, base64
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from ...core.config import CLASSES, POINTS_CHUNK_SIZE
from ...services.model_loader import load_model_by_id
from ...services.points import generate_random_points, normalize_manual_points
from ...services.inference import predict_points_batch
from ...services.draw import draw_points
import uuid
from fastapi.responses import Response

ANNOTATED_CACHE = {}

router = APIRouter()

@router.post("/process")
async def process(
    request: Request,
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

    model, tfm = await run_in_threadpool(load_model_by_id, model_id)

    if points_json:
        try:
            points = json.loads(points_json)
        except Exception:
            return JSONResponse({"error": "points_json inválido"}, status_code=400)
        points = normalize_manual_points(points, w, h)
    else:
        points = generate_random_points(w, h, n=n)

    # Inferencia en chunks: libera el event loop entre lotes y permite notar
    # si el cliente canceló la petición antes de terminar toda la imagen.
    pred_idxs, confs = [], []
    for i in range(0, len(points), POINTS_CHUNK_SIZE):
        if await request.is_disconnected():
            return Response(status_code=499)

        chunk = points[i:i + POINTS_CHUNK_SIZE]
        chunk_idxs, chunk_confs = await run_in_threadpool(
            predict_points_batch, img, chunk, model, tfm
        )
        pred_idxs.extend(chunk_idxs)
        confs.extend(chunk_confs)

    for p, idx, conf in zip(points, pred_idxs, confs):
        p["pred_label"] = CLASSES[int(idx)]
        p["confidence"] = float(conf)
        p.setdefault("method", "automatico")

    annotated = await run_in_threadpool(draw_points, img, points)

    buffer = io.BytesIO()
    annotated.save(buffer, format="PNG")
    png_bytes = buffer.getvalue()

    # 🔥 generar token y guardar imagen en memoria
    token = str(uuid.uuid4())
    ANNOTATED_CACHE[token] = png_bytes

    # solo para preview (si quieres mantenerlo)
    img_base64 = base64.b64encode(png_bytes).decode("utf-8")

    return {
        "annotated_image_base64": img_base64,
        "points": points,
        "download_token": token
    }

@router.get("/download/image/{token}")
def download_image(token: str):
    png = ANNOTATED_CACHE.get(token)
    if not png:
        return Response("Not found", status_code=404)

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": 'attachment; filename="imagen_anotada.png"'
        }
    )