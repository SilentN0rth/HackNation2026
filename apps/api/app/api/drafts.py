import json
from typing import Annotated, Literal

from fastapi import APIRouter, Body, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from app import lint
from app.api.deps import StoreDep
from app.coi.validator import errors as coi_errors
from app.errors import ApiError
from app.mapping.frontend import from_frontend, to_frontend
from app.pipeline import convert
from app.security import Official, User
from app.store.db import Store
from app.understand.text import slug
from app.uploads import read_upload

router = APIRouter(tags=["Wersje robocze"])
HEURISTICS = "heurystyki-pl@1"


class FlagPatch(BaseModel):
    action: Literal["fixed", "rejected"]
    justification: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def need_reason(self) -> FlagPatch:
        if self.action == "rejected" and len((self.justification or "").strip()) < 10:
            raise ValueError("Odrzucenie uwagi wymaga uzasadnienia (co najmniej 10 znaków).")
        return self


class DraftUpdate(BaseModel):
    schema_: dict = Field(alias="schema")


def with_resolutions(store: Store, draft: dict) -> list[dict]:
    resolved = store.resolutions(draft["id"])
    return [{**flag, **({"resolution": resolved[flag["id"]]} if flag["id"] in resolved else {})} for flag in draft["flags"]]


def open_counts(flags: list[dict]) -> tuple[int, int]:
    pending = [f for f in flags if "resolution" not in f]
    return (
        sum(1 for f in pending if f["severity"] == "error"),
        sum(1 for f in pending if f["severity"] == "warning"),
    )


def frontend_schema(draft: dict) -> dict:
    return to_frontend(
        draft["coi"],
        draft["meta"],
        schema_id=draft["id"],
        version=draft["version"],
        issuer=draft["issuer"],
        source_file=draft["source_file"],
    )


def draft_body(draft: dict) -> dict:
    return {
        "id": draft["id"],
        "status": draft["status"],
        "createdAt": draft["created_at"],
        "updatedAt": draft["updated_at"],
        "createdBy": draft["created_by"],
        "schema": frontend_schema(draft),
    }


def summary(form: dict) -> str:
    return f"Wniosek składany do: {form['issuer']}." if form.get("issuer") else "Wniosek składany elektronicznie."


def minutes(form: dict) -> int:
    count = sum(len(p["fields"]) for p in form["pages"])
    return max(3, round(count * 0.4))


def published_body(record: dict) -> dict:
    schema = to_frontend(
        record["coi"],
        record["meta"],
        schema_id=record["id"],
        version=record["version"],
        issuer=record["issuer"],
        source_file=record["source_file"],
    )
    return {
        "id": record["id"],
        "draftId": record["draft_id"],
        "version": record["version"],
        "publishedAt": record["published_at"],
        "publishedBy": record["published_by"],
        "schema": schema,
        "summary": summary(schema),
        "estimatedMinutes": minutes(schema),
    }


def load(store: Store, draft_id: str) -> dict:
    draft = store.draft(draft_id)
    if draft is None:
        raise ApiError(404, "Nie ma takiej wersji roboczej.")
    return draft


def relint(store: Store, draft: dict, user: User) -> list[dict]:
    flags = lint.run(draft["coi"], draft["meta"])
    store.update_draft(draft["id"], flags=flags)
    errors = sum(1 for f in flags if f["severity"] == "error")
    store.audit(draft["id"], user.id, "System", "linters_run", f"Kontrola jakości: {len(flags)} uwag, w tym {errors} krytycznych.")
    draft["flags"] = flags
    return with_resolutions(store, draft)


@router.post("/drafts", status_code=201, summary="Wgranie formularza i utworzenie wersji roboczej")
async def create_draft(user: Official, store: StoreDep, file: Annotated[UploadFile, File()]) -> dict:
    upload = await read_upload(file)
    result = await run_in_threadpool(convert, upload, None)
    draft_id = store.create_draft(
        title=result.coi["title"],
        source_file=upload.name,
        sha256=result.sha256,
        issuer=result.issuer,
        user_id=user.name,
        coi=result.coi,
        meta=result.meta,
        flags=result.flags,
        extras={"legalBasis": result.legal_basis, "warnings": result.warnings, "model": result.model},
    )
    store.audit(draft_id, user.id, user.name, "upload", f"Wgrano plik {upload.name} ({len(upload.data) // 1024} KB, sha256 {result.sha256[:12]}…).")
    store.audit(
        draft_id,
        "system",
        "System",
        "draft_generated",
        f"Wygenerowano formularz: {len(result.coi['tabs'])} stron.",
        f"{result.model or HEURISTICS}#{result.sha256[:12]}",
    )
    errors = sum(1 for f in result.flags if f["severity"] == "error")
    store.audit(draft_id, "system", "System", "linters_run", f"Kontrola jakości: {len(result.flags)} uwag, w tym {errors} krytycznych.")
    return {"draftId": draft_id}


@router.post("/coi/import", status_code=201, summary="Wgranie gotowego pliku JSON COI")
async def import_coi(user: Official, store: StoreDep, file: Annotated[UploadFile, File()]) -> dict:
    raw = await file.read()
    try:
        coi = json.loads(raw)
    except ValueError as exc:
        raise ApiError(422, "Plik nie jest poprawnym JSON-em.") from exc
    problems = coi_errors(coi) if isinstance(coi, dict) else []
    if not isinstance(coi, dict) or any(p.code in ("tabs", "title") for p in problems):
        raise ApiError(422, "Plik nie wygląda na konfigurację formularza COI.")
    flags = lint.run(coi, {})
    draft_id = store.create_draft(
        title=coi.get("title", "Formularz"),
        source_file=file.filename or "import.json",
        sha256="",
        issuer="",
        user_id=user.name,
        coi=coi,
        meta={},
        flags=flags,
        extras={},
    )
    store.audit(draft_id, user.id, user.name, "upload", f"Zaimportowano plik JSON {file.filename}.")
    return {"draftId": draft_id}


@router.get("/drafts", summary="Lista wersji roboczych")
def list_drafts(user: Official, store: StoreDep) -> list[dict]:
    result = []
    for draft in store.drafts():
        errors, warnings = open_counts(with_resolutions(store, draft))
        result.append(
            {
                "id": draft["id"],
                "title": draft["title"],
                "status": draft["status"],
                "updatedAt": draft["updated_at"],
                "sourceFile": draft["source_file"],
                "openErrors": errors,
                "openWarnings": warnings,
            }
        )
    return result


@router.get("/drafts/{draft_id}", summary="Wersja robocza w modelu edytora")
def get_draft(draft_id: str, user: Official, store: StoreDep) -> dict:
    return draft_body(load(store, draft_id))


@router.put("/drafts/{draft_id}", summary="Zapis zmian z edytora")
def update_draft(draft_id: str, body: DraftUpdate, user: Official, store: StoreDep) -> dict:
    draft = load(store, draft_id)
    if draft["status"] == "published":
        raise ApiError(409, "Opublikowanego formularza nie można zmieniać. Utwórz nową wersję.")
    coi, meta = from_frontend(draft["coi"], draft["meta"], body.schema_)
    version = draft["version"] + 1
    store.update_draft(draft_id, coi=coi, meta=meta, version=version, title=coi.get("title", draft["title"]))
    store.audit(draft_id, user.id, user.name, "field_edited", f"Zapisano zmiany w edytorze (wersja {version}).")
    draft = load(store, draft_id)
    relint(store, draft, user)
    return draft_body(load(store, draft_id))


@router.get("/drafts/{draft_id}/coi", summary="Plik JSON COI do pobrania")
def export_coi(draft_id: str, user: Official, store: StoreDep, download: Annotated[bool, Query()] = False) -> JSONResponse:
    draft = load(store, draft_id)
    headers = {"Content-Disposition": f'attachment; filename="{slug(draft["title"])}.json"'} if download else {}
    return JSONResponse(draft["coi"], headers=headers)


@router.post("/drafts/{draft_id}/lint", summary="Ponowna kontrola jakości")
def run_lint(draft_id: str, user: Official, store: StoreDep) -> list[dict]:
    return relint(store, load(store, draft_id), user)


@router.patch("/drafts/{draft_id}/flags/{flag_id}", summary="Decyzja w sprawie uwagi")
def resolve_flag(draft_id: str, flag_id: str, body: FlagPatch, user: Official, store: StoreDep) -> dict:
    draft = load(store, draft_id)
    flag = next((f for f in draft["flags"] if f["id"] == flag_id), None)
    if flag is None:
        raise ApiError(404, "Nie ma takiej uwagi.")
    resolution = store.resolve(draft_id, flag_id, body.action, (body.justification or "").strip() or None, user.name)
    action = "flag_fixed" if body.action == "fixed" else "flag_rejected"
    details = f"„{flag['title']}”" + (f" – uzasadnienie: {resolution.get('justification')}" if resolution.get("justification") else "")
    store.audit(draft_id, user.id, user.name, action, details)
    return {**flag, "resolution": resolution}


@router.post("/drafts/{draft_id}/publish", summary="Publikacja e-usługi")
def publish(draft_id: str, user: Official, store: StoreDep) -> dict:
    draft = load(store, draft_id)
    errors, _ = open_counts(with_resolutions(store, draft))
    if errors:
        raise ApiError(409, f"Zostały nierozwiązane uwagi krytyczne: {errors}. Obsłuż je przed publikacją.", openErrors=errors)
    record = store.publish(draft, user.name)
    store.audit(draft_id, user.id, user.name, "published", f"Opublikowano wersję {draft['version']} jako {record['id']}.")
    return published_body(record)


@router.get("/drafts/{draft_id}/statute-chunks", summary="Fragmenty przepisów powiązane z formularzem")
def statute_chunks(draft_id: str, user: Official, store: StoreDep) -> list[dict]:
    draft = load(store, draft_id)
    return [
        {"id": f"{draft_id}-legal-{i}", "act": text, "unit": "", "text": text}
        for i, text in enumerate(draft["extras"].get("legalBasis") or [])
    ]


@router.get("/audit", summary="Dziennik decyzji")
def audit(user: Official, store: StoreDep, draftId: Annotated[str | None, Query()] = None) -> list[dict]:
    return store.audit_trail(draftId)


@router.get("/audit/verify", summary="Sprawdzenie integralności dziennika")
def audit_verify(user: Official, store: StoreDep) -> dict:
    return {"intact": store.verify_audit()}


@router.put("/drafts/{draft_id}/coi", summary="Podmiana JSON COI wersji roboczej")
def replace_coi(draft_id: str, user: Official, store: StoreDep, coi: Annotated[dict, Body()]) -> dict:
    draft = load(store, draft_id)
    if draft["status"] == "published":
        raise ApiError(409, "Opublikowanego formularza nie można zmieniać.")
    store.update_draft(draft_id, coi=coi, version=draft["version"] + 1, title=coi.get("title", draft["title"]))
    store.audit(draft_id, user.id, user.name, "field_edited", "Podmieniono konfigurację JSON.")
    relint(store, load(store, draft_id), user)
    return draft_body(load(store, draft_id))
