import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    max_upload_mb: float = 20
    max_pages: int = 40
    max_unpacked_mb: float = 200
    allowed_extensions: list[str] = [".pdf", ".doc", ".docx", ".ods", ".xlsx", ".jpg", ".jpeg", ".png"]

    auth_enabled: bool = True
    jwt_secret: str = ""
    jwt_secret_file: Path = Path("/run/secrets/jwt_secret")
    jwt_algorithm: str = "HS256"
    jwt_ttl_min: int = 480
    jwt_issuer: str = "e-formularze"

    cors_origins: list[str] = ["http://localhost:5173"]
    db_path: Path = Path("data/app.db")
    attachments_dir: Path = Path("data/attachments")

    ocr_lang: str = "pol"
    tesseract_cmd: str = "tesseract"
    soffice_cmd: str = "soffice"
    converter_timeout_s: float = 90

    llm_enabled: bool = False
    ollama_url: str = "http://ollama:11434"
    llm_model: str = "qwen3:4b"
    llm_timeout_s: float = 60

    default_issuer: str = "Urząd Gminy"
    clause_url: str = ""

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)

    @property
    def max_unpacked_bytes(self) -> int:
        return int(self.max_unpacked_mb * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def jwt_secret() -> str:
    settings = get_settings()
    if settings.jwt_secret:
        return settings.jwt_secret
    if settings.jwt_secret_file.is_file():
        value = settings.jwt_secret_file.read_text().strip()
        if value:
            return value
    if not settings.auth_enabled:
        # Bez uwierzytelniania tokeny nie są sprawdzane, więc wystarczy klucz jednorazowy.
        return secrets.token_urlsafe(48)
    raise RuntimeError(
        "Brak sekretu JWT. Ustaw zmienną JWT_SECRET albo wskaż plik w JWT_SECRET_FILE "
        f"(obecnie: {settings.jwt_secret_file}). Plik secrets/jwt_secret.txt utworzysz poleceniem "
        "./scripts/make-secrets.sh z katalogu głównego repozytorium. "
        "Bez stałego sekretu tokeny przestają działać po restarcie i między workerami."
    )
