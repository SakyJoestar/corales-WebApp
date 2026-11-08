from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .core.config import FRONTEND_DIR
from .api.router import router

app = FastAPI()
app.include_router(router)


# El frontend no tiene build step ni hash en los nombres: sin esto el navegador
# puede mezclar un index.html nuevo con módulos JS viejos cacheados.
# "no-cache" obliga a revalidar (ETag/Last-Modified), así que sigue siendo barato.
@app.middleware("http")
async def no_cache_frontend(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-cache"
    return response

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(Path(FRONTEND_DIR) / "index.html")