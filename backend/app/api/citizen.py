"""Obywatel: opublikowane formularze, makieta danych inicjalnych, wnioski (UPO – makieta)."""

import json
import re
from functools import cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query
from fastapi import Path as PathParam
from pydantic import BaseModel, Field

from app.api.deps import DbDep
from app.config import get_settings
from app.errors import ApiError
from app.mapping.frontend import coi_to_front
from app.security import CitizenUser
from app.store import repo

router = APIRouter(tags=["citizen"])


def published_to_front(f: dict[str, Any]) -> dict[str, Any]:
    slug = re.sub(r"[^a-z0-9]+", "-", f["coi"]["title"].lower())[:40].strip("-")
    return {
        "id": f["id"],
        "draftId": f["draftId"],
        "version": f["version"],
        "publishedAt": f["publishedAt"],
        "publishedBy": f["publishedBy"],
        "schema": coi_to_front(f["coi"], f["meta"], slug, f["version"], ""),
        "summary": f["summary"],
        "estimatedMinutes": f["estimatedMinutes"],
    }


def _form(db, form_id: str) -> dict[str, Any]:
    f = repo.get_published(db, form_id)
    if f is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma formularza {form_id}.")
    return f


@router.get("/forms")
def list_forms(user: CitizenUser, db: DbDep) -> list[dict[str, Any]]:
    return [published_to_front(f) for f in repo.list_published(db)]


@router.get("/forms/{form_id}")
def get_form(form_id: Annotated[str, PathParam(max_length=120)], user: CitizenUser, db: DbDep) -> dict[str, Any]:
    return published_to_front(_form(db, form_id))


@router.get("/forms/{form_id}/coi")
def get_form_coi(form_id: Annotated[str, PathParam(max_length=120)], user: CitizenUser, db: DbDep) -> dict[str, Any]:
    return _form(db, form_id)["coi"]


@cache
def _prefill_mock() -> dict[str, str]:
    data = json.loads((Path(get_settings().data_dir) / "prefill_mock.json").read_text())
    return {k: v for k, v in data.items() if not k.startswith("_")}


@router.get("/prefill")
def prefill(user: CitizenUser, db: DbDep, formId: Annotated[str, Query(max_length=120)]) -> dict[str, str]:  # noqa: N803
    """MAKIETA danych inicjalnych (MLPZ/PESEL) – tylko klucze, o które pyta formularz. Dane fikcyjne."""
    f = _form(db, formId)
    wanted: set[str] = set()
    for tab in f["coi"]["tabs"]:
        for q in tab["questions"]:
            for c in q["field"].get("repeatingSectionGrid") or []:
                if c["field"].get("defaultValueType") == "EXTERNAL_SYSTEM":
                    wanted.add(str(c["field"].get("defaultValue")))
    return {k: v for k, v in _prefill_mock().items() if k in wanted}


class ApplicationIn(BaseModel):
    formId: Annotated[str, Field(max_length=120)]
    formTitle: Annotated[str, Field(max_length=255)]
    status: Literal["draft", "sent"]
    values: dict[str, str | bool | list[str]] = {}
    confirmationNo: str | None = None


@router.get("/applications")
def list_applications(user: CitizenUser, db: DbDep, mine: bool = True) -> list[dict[str, Any]]:
    return repo.list_applications(db, user.id)


@router.get("/applications/{app_id}")
def get_application(app_id: Annotated[str, PathParam(max_length=64)], user: CitizenUser, db: DbDep) -> dict[str, Any]:
    a = repo.get_application(db, app_id, user.id)
    if a is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma wniosku {app_id}.")
    return a


@router.post("/applications", status_code=201)
def create_application(body: ApplicationIn, user: CitizenUser, db: DbDep) -> dict[str, Any]:
    _form(db, body.formId)
    return repo.save_application(db, user.id, body.model_dump())


@router.put("/applications/{app_id}")
def update_application(app_id: Annotated[str, PathParam(max_length=64)], body: ApplicationIn, user: CitizenUser,
                       db: DbDep) -> dict[str, Any]:
    existing = repo.get_application(db, app_id, user.id)
    if existing is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma wniosku {app_id}.")
    if existing["status"] != "draft":
        raise ApiError(409, "Wniosek wysłany", "Wysłanego wniosku nie można zmieniać.")
    return repo.save_application(db, user.id, body.model_dump(), app_id)
