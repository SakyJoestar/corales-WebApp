from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .core.config import FRONTEND_DIR
from .api.router import router

app = FastAPI()
app.include_router(router)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(FRONTEND_DIR) / "index.html")