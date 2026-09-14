import os
from fastapi import APIRouter
from fastapi.responses import FileResponse
from ...core.config import FRONTEND_DIR

router = APIRouter()

@router.get("/")
def home():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))