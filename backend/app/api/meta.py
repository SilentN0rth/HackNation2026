"""Zdrowie, logowanie (makieta węzła krajowego), bieżący użytkownik, słowniki."""

import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Query
from fastapi import Path as PathParam
from pydantic import BaseModel

from app.api.deps import IndexDep, LlmDep, SettingsDep
from app.errors import ApiError
from app.security import DEMO_USERS, CurrentUser, Role, User, issue_token

router = APIRouter(tags=["meta"])


class Health(BaseModel):
    status: str
    llm: str
    llmModel: str
    statuteChunks: int


@router.get("/health")
def health(llm: LlmDep, index: IndexDep) -> Health:
    state = "disabled" if not llm.enabled else ("up" if llm.health() else "down")
    return Health(status="ok", llm=state, llmModel=llm.settings.llm_model, statuteChunks=len(index.chunks))


class TokenRequest(BaseModel):
    userId: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


@router.post("/auth/token")
def token(body: TokenRequest, settings: SettingsDep) -> TokenResponse:
    """Makieta logowania (węzeł krajowy): token dla użytkownika z listy demo."""
    user = DEMO_USERS.get(body.userId)
    if user is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma użytkownika {body.userId}.")
    return TokenResponse(access_token=issue_token(user, settings), user=user)


@router.get("/me")
def me(user: CurrentUser, role: Annotated[Role | None, Query()] = None) -> User:
    return user


def _dict_dir(settings) -> Path:
    return Path(settings.data_dir) / "dictionaries"


@router.get("/dictionaries")
def dictionaries(settings: SettingsDep) -> list[dict[str, Any]]:
    d = _dict_dir(settings)
    out = list(json.loads((d / "coi.json").read_text())["dictionaries"])
    for p in sorted(d.glob("propozycja_*.json")):
        data = json.loads(p.read_text())
        out.append({k: data[k] for k in ("name", "title", "allowedTypes", "usage", "source")})
    return out


@router.get("/dictionaries/{name}")
def dictionary(name: Annotated[str, PathParam(max_length=80)], settings: SettingsDep) -> dict[str, Any]:
    d = _dict_dir(settings)
    for p in d.glob("propozycja_*.json"):
        data = json.loads(p.read_text())
        if data["name"] == name:
            return data
    for entry in json.loads((d / "coi.json").read_text())["dictionaries"]:
        if entry["name"] == name:
            return {**entry, "items": [], "note": "Wartości słownika dostarcza platforma COI."}
    raise ApiError(404, "Nie znaleziono", f"Nie ma słownika {name}.")
