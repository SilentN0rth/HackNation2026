from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app import dictionaries
from app.config import get_settings
from app.errors import ApiError
from app.extract.doc import converter_available
from app.extract.image import ocr_available
from app.security import USERS, AnyUser, Role, issue_token
from app.understand import llm

router = APIRouter(tags=["System"])


class TokenRequest(BaseModel):
    userId: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


@router.get("/health", summary="Stan usługi")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "ocr": ocr_available(),
        "docConverter": converter_available(),
        "llm": ("up" if llm.available() else "down") if settings.llm_enabled else "disabled",
        "auth": settings.auth_enabled,
        "maxUploadMb": settings.max_upload_mb,
    }


@router.post("/auth/token", response_model=TokenResponse, summary="Token JWT dla konta demonstracyjnego")
def token(body: TokenRequest) -> TokenResponse:
    user = USERS.get(body.userId)
    if user is None:
        raise ApiError(404, "Nie ma takiego użytkownika.")
    value, ttl = issue_token(user)
    return TokenResponse(access_token=value, expires_in=ttl, user=user.public())


@router.get("/me", summary="Zalogowany użytkownik")
def me(user: AnyUser, role: Annotated[Role | None, Query()] = None) -> dict:
    return user.public()


@router.get("/dictionaries", summary="Lista słowników")
def dictionary_list() -> list[dict]:
    return dictionaries.listing()


@router.get("/dictionaries/{name}", summary="Wartości słownika")
def dictionary(name: str) -> dict:
    entry = dictionaries.get(name)
    if entry is None:
        raise ApiError(404, "Nie ma takiego słownika.")
    return entry
