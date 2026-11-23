import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    HF_API_KEY: str = os.getenv("HF_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()