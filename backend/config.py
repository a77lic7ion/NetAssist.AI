from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional
import os

class Settings(BaseSettings):
    app_name: str = "NetVal Backend"
    port: int = 8742
    # Use local directory for DB to avoid permission issues
    db_path: str = str(Path(os.getcwd()) / "data" / "netval.db")
    
    # AI Settings
    llm_provider: str = "ollama"  # ollama, gemini, openai, mistral, anthropic
    llm_model: str = "llama3.2:3b"
    llm_base_url: Optional[str] = "http://localhost:11434"
    llm_api_key: Optional[str] = None
    
    max_ssh_connections: int = 5
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
