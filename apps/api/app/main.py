import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.api import citizen, convert, drafts, meta
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

DESCRIPTION = """
Usługa zamienia papierowe formularze urzędowe (PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG, PNG)
na konfigurację formularza elektronicznego w formacie JSON COI.

Najważniejszy punkt: `POST /api/v1/convert`. Pozostałe ścieżki obsługują edytor urzędnika,
kontrolę jakości, dziennik decyzji i podgląd e-usługi dla obywatela.
"""


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="e-Formularze API",
        version="1.0.0",
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )
    errors.install(app)
    for module in (meta, convert, drafts, citizen):
        app.include_router(module.router)
    return app


app = create_app()
