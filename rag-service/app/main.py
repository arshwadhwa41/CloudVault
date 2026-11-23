from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    allow_origins=["*"],  # Production mein specific domains allow kar sakte hain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Chat Router with API prefix
app.include_router(chat_router, prefix="/api/v1")

app.include_router(upload_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "success": True,
        "message": "CloudVault Multi-Modal RAG Microservice is running successfully!"
    }

@app.get("/health")
def health_check():
    return {"status": "CloudVault RAG Service is running smoothly!"}

