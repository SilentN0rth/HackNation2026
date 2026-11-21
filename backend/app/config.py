"""Konfiguracja z env (pydantic-settings). Pełna tabela zmiennych: README.md."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


def _read_secret_file(path: str) -> str | None:
    p = Path(path)
    return p.read_text().strip() if p.is_file() else None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- upload ---
    max_upload_mb: int = 20
    max_pages: int = 30
    max_unzipped_mb: int = 200
    allowed_extensions: list[str] = Field(
        default=[".pdf", ".doc", ".docx", ".ods", ".xlsx", ".jpg", ".jpeg", ".jpe", ".png"]
    )

    # --- auth ---
    auth_enabled: bool = False
    jwt_secret: str | None = None
    jwt_secret_file: str = "/run/secrets/jwt_secret"
    jwt_ttl_min: int = 480

    # --- LLM (Ollama, lokalnie) ---
    llm_enabled: bool = False
    ollama_url: str = "http://localhost:11434"
    llm_model: str = "qwen3:4b"
    llm_timeout_s: float = 60.0

    # --- OCR / konwersje ---
    ocr_lang: str = "pol"
    soffice_bin: str = "soffice"

    # --- inne ---
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:3100"])
    db_path: str = str(BASE_DIR / "data" / "coi.sqlite3")
    data_dir: str = str(BASE_DIR / "data")

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def resolved_jwt_secret(self) -> str:
        secret = self.jwt_secret or _read_secret_file(self.jwt_secret_file)
        if secret:
            return secret
        if self.auth_enabled:
            raise RuntimeError("AUTH_ENABLED=true wymaga JWT_SECRET albo pliku /run/secrets/jwt_secret")
        return "dev-only-insecure-secret"


@lru_cache
def get_settings() -> Settings:
    return Settings()
