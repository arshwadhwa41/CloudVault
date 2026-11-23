from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routes.chat import router as chat_router
from app.routes.upload import router as upload_router

app = FastAPI(
    title="CloudVault Multi-Modal RAG Service",
    description="Standalone microservice for multi-modal file ingestion and RAG chat",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes pehle register karo
app.include_router(chat_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "CloudVault RAG Service is running smoothly!"}


# Frontend dist directory resolve karo (dono possible paths support)
BASE_DIR = Path(__file__).resolve().parent.parent
POSSIBLE_DIST_DIRS = [
    BASE_DIR / "frontend" / "dist",
    BASE_DIR.parent / "frontend" / "dist",
]
FRONTEND_DIST_DIR = next(
    (p for p in POSSIBLE_DIST_DIRS if (p / "index.html").exists()),
    POSSIBLE_DIST_DIRS[0],
)
ASSETS_DIR = FRONTEND_DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def read_root():
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "success": True,
        "message": "CloudVault Multi-Modal RAG Microservice is running successfully!",
        "dist_checked": [str(p) for p in POSSIBLE_DIST_DIRS],
    }


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not Found")

    candidate_file = FRONTEND_DIST_DIR / full_path
    if full_path and candidate_file.is_file():
        return FileResponse(candidate_file)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend build not found")