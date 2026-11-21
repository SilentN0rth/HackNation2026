"""FastAPI – Cyfryzacja formularzy (HackNation 2026, COI). Opis API: /docs (OpenAPI)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import audit, citizen, convert, drafts, meta
from app.config import get_settings
from app.errors import install_error_handlers
from app.store.db import Database


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.resolved_jwt_secret  # noqa: B018 – AUTH_ENABLED bez sekretu: błąd przy starcie, nie przy 1. żądaniu
    app.state.db = Database(settings.db_path)
    app.state.jobs = {}
    yield
    app.state.db.close()


app = FastAPI(
    title="COI – Cyfryzacja formularzy",
    description="Stary formularz (PDF/DOC/DOCX/ODS/XLSX/JPG/PNG) → JSON COI z podstawą prawną i linterami. "
    "Minimum COI: `POST /api/v1/convert`.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
install_error_handlers(app)
for r in (meta.router, convert.router, drafts.router, audit.router, citizen.router):
    app.include_router(r)
