import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.api import attachments, citizen, convert, drafts, meta
from app.config import get_settings, jwt_secret

CONVERT_PATH = "/api/v1/convert"
MULTIPART_SLACK = 64 * 1024

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

DESCRIPTION = """
Usługa zamienia papierowe formularze urzędowe (PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG, PNG)
na konfigurację formularza elektronicznego w formacie JSON COI.

Najważniejszy punkt: `POST /api/v1/convert`. Pozostałe ścieżki obsługują edytor urzędnika,
kontrolę jakości, dziennik decyzji i podgląd e-usługi dla obywatela.
"""


class ConvertBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == CONVERT_PATH:
            length = dict(scope["headers"]).get(b"content-length", b"")
            settings = get_settings()
            if length.isdigit() and int(length) > settings.max_upload_bytes + MULTIPART_SLACK:
                response = errors.problem(413, f"Plik jest większy niż {settings.max_upload_mb:g} MB.", instance=CONVERT_PATH)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.auth_enabled:
        jwt_secret()  # brak sekretu zatrzymuje start zamiast unieważniać tokeny po restarcie
    app = FastAPI(
        title="e-Formularze API",
        version="1.0.0",
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url=None,
    )
    app.add_middleware(ConvertBodyLimit)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )
    errors.install(app)
    for module in (meta, convert, drafts, citizen, attachments):
        app.include_router(module.router)
    return app


app = create_app()
