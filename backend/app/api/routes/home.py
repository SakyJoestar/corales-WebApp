from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from ...core.config import FRONTEND_DIR

router = APIRouter()

FRONTEND_ROOT = Path(FRONTEND_DIR).resolve()


def _frontend_version() -> str:
    # Cambia cada vez que se edita cualquier archivo del frontend.
    latest = max(
        (p.stat().st_mtime_ns for p in FRONTEND_ROOT.rglob("*") if p.is_file()),
        default=0,
    )
    return format(latest, "x")


@router.get("/")
def home():
    # Reescribe /static/... -> /static/v-<version>/... para que el navegador
    # nunca mezcle un index.html nuevo con CSS/JS viejos de su caché. Los imports
    # relativos de los módulos JS heredan el prefijo versionado.
    html = (FRONTEND_ROOT / "index.html").read_text(encoding="utf-8")
    html = html.replace("/static/", f"/static/v-{_frontend_version()}/")
    return HTMLResponse(html)


@router.get("/static/v-{version}/{path:path}", include_in_schema=False)
def versioned_static(version: str, path: str):
    target = (FRONTEND_ROOT / path).resolve()
    if not target.is_file() or not target.is_relative_to(FRONTEND_ROOT):
        raise HTTPException(status_code=404)
    return FileResponse(target)
