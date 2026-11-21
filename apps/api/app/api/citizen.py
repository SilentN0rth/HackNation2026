import json
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import StoreDep
from app.api.drafts import published_body
from app.errors import ApiError
from app.security import AnyUser, Citizen

router = APIRouter(tags=["Obywatel"])
PREFILL = Path(__file__).resolve().parents[2] / "data" / "prefill_demo.json"


class ApplicationIn(BaseModel):
    id: str | None = None
    formId: str
    formTitle: str | None = None
    status: Literal["draft", "sent"]
    values: dict[str, str | bool] = Field(default_factory=dict)


def public(app: dict) -> dict:
    return {k: v for k, v in app.items() if k != "userId"}


@router.get("/forms", summary="Opublikowane e-usługi")
def forms(user: AnyUser, store: StoreDep) -> list[dict]:
    return [published_body(r) for r in store.published_forms()]


@router.get("/forms/{form_id}", summary="Opublikowana e-usługa")
def form(form_id: str, user: AnyUser, store: StoreDep) -> dict:
    record = store.published(form_id)
    if record is None:
        raise ApiError(404, "Nie ma takiej e-usługi.")
    return published_body(record)


@router.get("/prefill", summary="Dane inicjalne (dane demonstracyjne)")
def prefill(user: Citizen, store: StoreDep, formId: Annotated[str, Query()]) -> dict[str, str]:
    if store.published(formId) is None:
        raise ApiError(404, "Nie ma takiej e-usługi.")
    return json.loads(PREFILL.read_text(encoding="utf-8"))


@router.get("/applications", summary="Wnioski obywatela")
def applications(user: Citizen, store: StoreDep, mine: Annotated[bool, Query()] = True) -> list[dict]:
    return [public(a) for a in store.applications(user.id)]


@router.get("/applications/{app_id}", summary="Wniosek obywatela")
def application(app_id: str, user: Citizen, store: StoreDep) -> dict:
    record = store.application(app_id)
    if record is None or record["userId"] != user.id:
        raise ApiError(404, "Nie ma takiego wniosku.")
    return public(record)


def _save(body: ApplicationIn, user, store, app_id: str | None) -> dict:
    form = store.published(body.formId)
    if form is None:
        raise ApiError(404, "Nie ma takiej e-usługi.")
    if app_id:
        existing = store.application(app_id)
        if existing is None or existing["userId"] != user.id:
            raise ApiError(404, "Nie ma takiego wniosku.")
        if existing["status"] != "draft":
            raise ApiError(409, "Wysłanego wniosku nie można zmieniać.")
    record = store.save_application(
        app_id=app_id,
        form_id=body.formId,
        form_title=body.formTitle or form["title"],
        status=body.status,
        user_id=user.id,
        answers=body.values,
    )
    return public(record)


@router.post("/applications", status_code=201, summary="Nowy wniosek")
def create_application(body: ApplicationIn, user: Citizen, store: StoreDep) -> dict:
    return _save(body, user, store, None)


@router.put("/applications/{app_id}", summary="Zapis wniosku")
def update_application(app_id: str, body: ApplicationIn, user: Citizen, store: StoreDep) -> dict:
    return _save(body, user, store, app_id)
