from fastapi import APIRouter
from .routes.home import router as home_router
from .routes.models import router as models_router
from .routes.processing import router as processing_router
from .routes.export import router as export_router
from .routes.batch import router as batch_router

router = APIRouter()
router.include_router(home_router)
router.include_router(models_router)
router.include_router(processing_router)
router.include_router(export_router)
router.include_router(batch_router)