"""Zależności FastAPI (Annotated) współdzielone przez routery."""

from typing import Annotated

from fastapi import Depends, Request, UploadFile

from app.config import Settings, get_settings
from app.errors import ApiError
from app.legal.index import LegalIndex, get_index
from app.store.db import Database
from app.understand.llm import LlmClient
from app.uploads import ValidatedUpload, validate_upload


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_llm(settings: Annotated[Settings, Depends(get_settings)]) -> LlmClient:
    return LlmClient(settings)


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Database, Depends(get_db)]
LlmDep = Annotated[LlmClient, Depends(get_llm)]
IndexDep = Annotated[LegalIndex, Depends(get_index)]


def read_upload(file: UploadFile, settings: Settings) -> ValidatedUpload:
    """Czyta plik strumieniowo do pamięci i przerywa po przekroczeniu limitu (bez zapisu na dysk)."""
    limit = settings.max_upload_bytes
    chunks: list[bytes] = []
    size = 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise ApiError(413, "Za duży plik", f"Plik jest większy niż {settings.max_upload_mb} MB.")
        chunks.append(chunk)
    return validate_upload(file.filename, b"".join(chunks), settings)
