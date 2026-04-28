from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router, service


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    service.close()


app = FastAPI(
    title="Where To Eat API",
    version="0.1.0",
    description="Restaurant recommendation API for campus dining decisions.",
    lifespan=lifespan,
)
app.include_router(router)
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def home_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/recommendations", include_in_schema=False)
def recommendations_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "recommendations.html")


@app.get("/restaurant-view", include_in_schema=False)
def restaurant_detail_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "restaurant.html")


@app.get("/map-view", include_in_schema=False)
def map_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "map.html")


@app.get("/review-import", include_in_schema=False)
def review_import_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "review-import.html")


@app.get("/admin", include_in_schema=False)
def admin_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "admin.html")
