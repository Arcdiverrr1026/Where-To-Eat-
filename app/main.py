from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router, service
from app.api.library import router as library_router
from app.services.library_service import LibraryError


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    service.start_background_prewarm()
    yield
    service.close()


app = FastAPI(
    title="Where To Eat API",
    version="0.1.0",
    description="Private restaurant experience library and code-based sharing.",
    lifespan=lifespan,
)
app.include_router(router)
app.include_router(library_router)


@app.exception_handler(LibraryError)
async def library_error_handler(_request, error: LibraryError):
    return JSONResponse(status_code=error.status, content={"detail": str(error)}, headers={"Cache-Control": "no-store"})


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets", check_dir=False), name="assets")


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
@app.get("/recommendations", include_in_schema=False)
@app.get("/restaurant-view", include_in_schema=False)
@app.get("/map-view", include_in_schema=False)
@app.get("/review-import", include_in_schema=False)
@app.get("/admin", include_in_schema=False)
@app.get("/discover", include_in_schema=False)
@app.get("/login", include_in_schema=False)
@app.get("/library", include_in_schema=False)
@app.get("/entries/new", include_in_schema=False)
@app.get("/entries/{entry_id}", include_in_schema=False)
@app.get("/entries/{entry_id}/edit", include_in_schema=False)
@app.get("/shares", include_in_schema=False)
@app.get("/shares/new", include_in_schema=False)
@app.get("/shares/import", include_in_schema=False)
def frontend_page() -> FileResponse:
    index = FRONTEND_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=503, detail="Frontend not built. Run npm ci && npm run build in frontend/.")
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
