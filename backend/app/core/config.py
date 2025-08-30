from pydantic_settings import BaseSettings
from pydantic import Field, AnyUrl
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    # Groq
    groq_api_key: str = Field(..., env="GROQ_API_KEY")
    groq_model: str = Field("llama-3.3-70b-versatile", env="GROQ_MODEL")

    # Qdrant
    qdrant_url: AnyUrl = Field(..., env="QDRANT_URL")
    qdrant_api_key: str = Field(..., env="QDRANT_API_KEY")
    qdrant_collection_prefix: str = Field("ai_tutor", env="QDRANT_COLLECTION_PREFIX")

    # Redis
    redis_url: str = Field(..., env="REDIS_URL")

    # Embeddings
    embedding_model: str = Field("all-MiniLM-L6-v2", env="EMBEDDING_MODEL")

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