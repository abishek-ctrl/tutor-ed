from pydantic_settings import BaseSettings
from pydantic import Field, AnyUrl
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    # Groq for chat completion
    groq_api_key: str = Field(..., env="GROQ_API_KEY")
    groq_model: str = Field("llama-3.1-70b-versatile", env="GROQ_MODEL")

    # Google Gemini for embeddings
    google_api_key: str = Field(..., env="GOOGLE_API_KEY")
    gemini_embedding_model: str = Field("models/embedding-001", env="GEMINI_EMBEDDING_MODEL")
    gemini_embedding_dimensionality: int = Field(768, env="GEMINI_EMBEDDING_DIMENSIONALITY")

    # Qdrant
    qdrant_url: AnyUrl = Field(..., env="QDRANT_URL")
    qdrant_api_key: str = Field(..., env="QDRANT_API_KEY")
    qdrant_collection_prefix: str = Field("ai_tutor", env="QDRANT_COLLECTION_PREFIX")

    # Redis
    redis_url: str = Field(..., env="REDIS_URL")

    # Ingest chunking
    chunk_token_size: int = Field(600, env="CHUNK_TOKEN_SIZE")
    chunk_overlap: int = Field(64, env="CHUNK_OVERLAP")

    # Server
    host: str = Field("0.0.0.0", env="HOST")
    port: int = Field(8000, env="PORT")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

