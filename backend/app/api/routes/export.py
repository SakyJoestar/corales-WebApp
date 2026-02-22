from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse

from ...services.excel_export import export_single_excel

router = APIRouter()

@router.post("/export/excel")
def export_excel(payload: dict = Body(...)):
    points = payload.get("points", [])
    model_id = payload.get("model_id", "")
    image_name = payload.get("image_name", "imagen")

    bio = export_single_excel(points=points, model_id=model_id, image_name=image_name)

    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="puntos_coral.xlsx"'}
    )