from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .core.config import STATIC_DIR
from .api.router import router

app = FastAPI()
app.include_router(router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")