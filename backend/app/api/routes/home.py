import os
from fastapi import APIRouter
from fastapi.responses import FileResponse
from ...core.config import STATIC_DIR

router = APIRouter()

@router.get("/")
def home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))