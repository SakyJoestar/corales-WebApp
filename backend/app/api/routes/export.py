from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse
from ...services.excel import export_single_excel

router = APIRouter()

@router.post("/export/excel")
def export_excel(payload: dict = Body(...)):
    points = payload.get("points", [])
    model_id = payload.get("model_id", "")
    bio = export_single_excel(points, model_id)

    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="puntos_coral.xlsx"'}
    )