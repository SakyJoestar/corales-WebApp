from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse

from ...core.config import MAX_BATCH_IMAGES
from ...services.model_loader import load_model_by_id
from ...services.batch import process_batch_zip

router = APIRouter()

@router.post("/process_batch")
async def process_batch(
    files: list[UploadFile] = File(...),
    n: int = Form(100),
    model_id: str = Form("")
):
    if not model_id:
        return JSONResponse({"error": "Selecciona un modelo"}, status_code=400)
    if not files:
        return JSONResponse({"error": "Sube al menos 1 imagen"}, status_code=400)
    if len(files) > MAX_BATCH_IMAGES:
        return JSONResponse({"error": f"Máximo {MAX_BATCH_IMAGES} imágenes"}, status_code=400)

    model, tfm = load_model_by_id(model_id)
    zip_buf, filename = await process_batch_zip(files, n, model_id, model, tfm)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )