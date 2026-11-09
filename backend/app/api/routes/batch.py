from fastapi import APIRouter, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from ...core.config import MAX_BATCH_IMAGES
from ...services.model_loader import load_major_model
from ...services.batch import process_batch_zip
from ...utils.images import open_image, InvalidImageError

router = APIRouter()

@router.post("/process_batch")
async def process_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    n: int = Form(100),
    model_id: str = Form(""),
    # Niveles de detalle: la categoría mayor siempre va; el estado depende de la subcategoría.
    include_subcategory: bool = Form(False),
    include_condition: bool = Form(False),
):
    if not model_id:
        return JSONResponse({"error": "Selecciona un modelo"}, status_code=400)
    if not files:
        return JSONResponse({"error": "Sube al menos 1 imagen"}, status_code=400)
    if len(files) > MAX_BATCH_IMAGES:
        return JSONResponse({"error": f"Máximo {MAX_BATCH_IMAGES} imágenes"}, status_code=400)

    # Todo el lote se valida antes de procesar: un archivo que no es PNG/JPG rechaza el
    # lote con su nombre, en vez de omitirse en silencio.
    errors = []
    for uf in files:
        try:
            open_image(await uf.read(), uf.filename)
        except InvalidImageError as e:
            errors.append(str(e))
        await uf.seek(0)
    if errors:
        return JSONResponse({"error": " ".join(errors)}, status_code=400)

    model, tfm, classes, patch_size = await run_in_threadpool(load_major_model, model_id)
    zip_buf, filename = await process_batch_zip(
        request, files, n, model_id, model, tfm, classes, patch_size,
        include_subcategory=include_subcategory,
        include_condition=include_subcategory and include_condition,
    )

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )