"""Wersje robocze urzędnika – ścieżki zgodne z frontend/src/api/httpApi.ts."""

import asyncio
import re
import threading
from collections.abc import AsyncIterable
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, File, Path, Query, Request, UploadFile
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel, Field

from app.api.deps import DbDep, IndexDep, LlmDep, SettingsDep, read_upload
from app.coi.validator import validate_coi
from app.errors import ApiError
from app.lint import LintFlag, can_publish, run_linters
from app.mapping.frontend import apply_front_schema, coi_to_front
from app.security import OfficialUser
from app.store import repo
from app.understand.pipeline import convert

router = APIRouter(tags=["drafts"])
DraftId = Annotated[str, Path(pattern=r"^draft-[a-z0-9]{6,32}$")]
MAX_BODY = 25 * 1024 * 1024


@dataclass
class Job:
    steps: list[str] = field(default_factory=list)
    done: bool = False
    error: str | None = None


def _jobs(request: Request) -> dict[str, Job]:
    return request.app.state.jobs


def _schema_id(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower())[:40].strip("-") or "formularz"


def draft_to_front(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": d["id"],
        "status": d["status"],
        "createdAt": d["createdAt"],
        "updatedAt": d["updatedAt"],
        "createdBy": d["createdBy"],
        "schema": coi_to_front(d["coi"], d["meta"], _schema_id(d["title"]), d["version"], d["sourceFile"]),
    }


def _get(db, draft_id: str) -> dict[str, Any]:
    d = repo.get_draft(db, draft_id)
    if d is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma wersji roboczej {draft_id}.")
    return d


class DraftCreated(BaseModel):
    draftId: str


@router.post("/drafts", max_body_size=MAX_BODY, status_code=201)
def create_draft(
    request: Request,
    file: Annotated[UploadFile, File()],
    user: OfficialUser,
    db: DbDep,
    settings: SettingsDep,
    llm: LlmDep,
    index: IndexDep,
    background: Annotated[bool, Query(alias="async", description="Przetwarzaj w tle; postęp: GET /drafts/{id}/events")]
    = False,
) -> DraftCreated:
    upload = read_upload(file, settings)
    draft_id = repo.new_draft_id()

    def run(job: Job | None) -> None:
        result = convert(upload, settings, on_step=(job.steps.append if job else None), llm=llm, index=index)
        repo.create_draft(db, user.as_dict(), draft_id=draft_id, title=result.build.coi["title"],
                          source_file=upload.filename, sha256=upload.sha256, coi=result.build.coi,
                          meta=result.build.meta, flags=result.flags, ai_output_ref=result.form.ai_output_ref)

    if not background:
        run(None)
        return DraftCreated(draftId=draft_id)

    job = Job()
    _jobs(request)[draft_id] = job

    def worker() -> None:
        try:
            run(job)
        except ApiError as e:
            job.error = e.detail
        except Exception as e:  # noqa: BLE001 – błąd trafia do klienta przez SSE
            job.error = f"Nie udało się przetworzyć pliku ({type(e).__name__})."
        finally:
            job.done = True

    threading.Thread(target=worker, daemon=True, name=f"convert-{draft_id}").start()
    return DraftCreated(draftId=draft_id)


@router.get("/drafts/{draft_id}/events", response_class=EventSourceResponse)
async def draft_events(request: Request, draft_id: DraftId, user: OfficialUser) -> AsyncIterable[ServerSentEvent]:
    """Etapy przetwarzania: upload → parse → ocr → generate → lint → done (dla `onProgress` na froncie)."""
    job = _jobs(request).get(draft_id)
    if job is None:
        yield ServerSentEvent(data={"step": "done", "draftId": draft_id}, event="step")
        return
    sent = 0
    while True:
        while sent < len(job.steps):
            yield ServerSentEvent(data={"step": job.steps[sent], "draftId": draft_id}, event="step", id=str(sent))
            sent += 1
        if job.done:
            if job.error:
                yield ServerSentEvent(data={"error": job.error, "draftId": draft_id}, event="error")
            _jobs(request).pop(draft_id, None)
            return
        if await request.is_disconnected():
            return
        await asyncio.sleep(0.15)


@router.get("/drafts")
def list_drafts(user: OfficialUser, db: DbDep) -> list[dict[str, Any]]:
    return repo.list_drafts(db)


@router.get("/drafts/{draft_id}")
def get_draft(request: Request, draft_id: DraftId, user: OfficialUser, db: DbDep) -> dict[str, Any]:
    if draft_id in _jobs(request):
        raise ApiError(409, "W przetwarzaniu", "Ten formularz jest jeszcze przetwarzany.")
    return draft_to_front(_get(db, draft_id))


class SchemaUpdate(BaseModel):
    schema_: Annotated[dict[str, Any], Field(alias="schema")]


@router.put("/drafts/{draft_id}")
def update_draft(draft_id: DraftId, body: SchemaUpdate, user: OfficialUser, db: DbDep, llm: LlmDep,
                 index: IndexDep) -> dict[str, Any]:
    """Zapis schematu z edytora → nowa wersja → automatyczny lint (rozstrzygnięcia flag zostają po id)."""
    d = _get(db, draft_id)
    if d["status"] == "published":
        raise ApiError(409, "Opublikowany", "Opublikowanej wersji nie można zmieniać – wgraj nową wersję.")
    coi, meta = apply_front_schema(d["coi"], d["meta"], body.schema_)
    flags = run_linters(coi, meta, index, llm, previous=d["flags"])
    repo.save_version(db, user.as_dict(), draft_id, coi, meta, flags)
    return draft_to_front(_get(db, draft_id))


@router.get("/drafts/{draft_id}/coi")
def get_coi(draft_id: DraftId, user: OfficialUser, db: DbDep) -> dict[str, Any]:
    """Czysty JSON COI do pobrania – bez naszych rozszerzeń (meta)."""
    return _get(db, draft_id)["coi"]


@router.post("/drafts/{draft_id}/lint", response_model_exclude_none=True)
def lint(draft_id: DraftId, user: OfficialUser, db: DbDep, llm: LlmDep, index: IndexDep) -> list[LintFlag]:
    d = _get(db, draft_id)
    flags = run_linters(d["coi"], d["meta"], index, llm, previous=d["flags"])
    repo.set_flags(db, user.as_dict(), draft_id, flags, log_details=f"Uruchomiono lintery: {len(flags)} flag.")
    return flags


class Resolution(BaseModel):
    action: Literal["fixed", "rejected"]
    justification: Annotated[str | None, Field(max_length=500)] = None


@router.patch("/drafts/{draft_id}/flags/{flag_id}", response_model_exclude_none=True)
def resolve_flag(draft_id: DraftId, flag_id: Annotated[str, Path(max_length=200)], body: Resolution,
                 user: OfficialUser, db: DbDep) -> LintFlag:
    from app.lint.base import FlagResolution
    from app.store.audit import now

    d = _get(db, draft_id)
    flag = next((f for f in d["flags"] if f.id == flag_id), None)
    if flag is None:
        raise ApiError(404, "Nie znaleziono", f"Nie ma flagi {flag_id}.")
    if body.action == "rejected" and len((body.justification or "").strip()) < 10:
        raise ApiError(422, "Brak uzasadnienia", "Odrzucenie flagi wymaga uzasadnienia (min. 10 znaków).")
    flag.resolution = FlagResolution(action=body.action, justification=body.justification, by=user.name, at=now())
    details = (f"Oznaczono jako poprawione: {flag.title}" if body.action == "fixed"
               else f"Odrzucono flagę: {flag.title}. Uzasadnienie: {body.justification}")
    repo.set_flags(db, user.as_dict(), draft_id, d["flags"], log_details=details,
                   action="flag_fixed" if body.action == "fixed" else "flag_rejected", ai_output_ref=flag.linter)
    return flag


class PublishBody(BaseModel):
    summary: Annotated[str, Field(max_length=300)] = "Złóż wniosek online – bez wizyty w urzędzie."
    estimatedMinutes: Annotated[int, Field(ge=1, le=120)] = 10


@router.post("/drafts/{draft_id}/publish")
def publish(draft_id: DraftId, user: OfficialUser, db: DbDep,
            body: Annotated[PublishBody | None, Body()] = None) -> dict[str, Any]:
    d = _get(db, draft_id)
    if not can_publish(d["flags"]):
        open_errors = [f.title for f in d["flags"] if f.severity == "error" and f.resolution is None]
        raise ApiError(409, "Nierozwiązane flagi", "Nie wszystkie krytyczne flagi zostały obsłużone.",
                       openErrors=open_errors)
    errors = [i.message for i in validate_coi(d["coi"]) if i.severity == "error"]
    if errors:
        raise ApiError(409, "Niezgodność z COI", "JSON nie przechodzi reguł technicznych COI.", errors=errors)
    body = body or PublishBody()
    form = repo.publish(db, user.as_dict(), d, body.summary, body.estimatedMinutes)
    from app.api.citizen import published_to_front

    return published_to_front(form)


@router.get("/drafts/{draft_id}/statute-chunks")
def statute_chunks(draft_id: DraftId, user: OfficialUser, db: DbDep, index: IndexDep) -> list[dict[str, str]]:
    """Fragmenty ustaw powiązane z polami (i do 20 najtrafniejszych dla tytułu formularza)."""
    d = _get(db, draft_id)
    ids = {m["legalBasis"]["chunkId"] for m in d["meta"].values() if m.get("legalBasis") and
           m["legalBasis"].get("chunkId")}
    chunks = [index.by_id[i] for i in ids if i in index.by_id]
    for h in index.search(d["title"], k=20):
        if h.chunk.id not in ids:
            chunks.append(h.chunk)
            ids.add(h.chunk.id)
    return [{"id": c.id, "act": c.act, "unit": c.unit, "text": c.text} for c in chunks]


@router.post("/coi/import", status_code=201, tags=["coi"])
def import_coi(coi: Annotated[dict[str, Any], Body()], user: OfficialUser, db: DbDep, llm: LlmDep,
               index: IndexDep) -> DraftCreated:
    """Wgranie gotowego JSON-a COI do edytora (round-trip, testy)."""
    errors = [i for i in validate_coi(coi) if i.rule == "schema"]
    if errors:
        raise ApiError(422, "Niepoprawny JSON COI", errors[0].message)
    import hashlib
    import json

    sha = hashlib.sha256(json.dumps(coi, sort_keys=True).encode()).hexdigest()
    flags = run_linters(coi, {}, index, llm)
    draft_id = repo.create_draft(db, user.as_dict(), title=coi.get("title", "Formularz"), source_file="import.json",
                                 sha256=sha, coi=coi, meta={}, flags=flags, ai_output_ref="import")
    return DraftCreated(draftId=draft_id)
