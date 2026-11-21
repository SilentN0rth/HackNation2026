"""Operacje na danych (wersje robocze, wersje, flagi, publikacje, wnioski). Audit dopisujemy w tej samej transakcji."""

import json
import random
import uuid
from typing import Any

from app.lint.base import LintFlag
from app.store import audit
from app.store.audit import now
from app.store.db import Database

User = dict[str, str]


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def new_draft_id() -> str:
    return _uid("draft")


def create_draft(db: Database, user: User, *, title: str, source_file: str, sha256: str, coi: dict, meta: dict,
                 flags: list[LintFlag], ai_output_ref: str, draft_id: str | None = None) -> str:
    draft_id = draft_id or new_draft_id()
    ts = now()
    with db.tx() as c:
        c.execute(
            "INSERT INTO drafts (id, status, title, source_file, source_sha256, created_at, updated_at, created_by,"
            " current_version, flags_json) VALUES (?,?,?,?,?,?,?,?,1,?)",
            (draft_id, "review", title, source_file, sha256, ts, ts, user["name"],
             json.dumps([f.model_dump() for f in flags], ensure_ascii=False)),
        )
        c.execute("INSERT INTO draft_versions VALUES (?,?,?,?,?,?)",
                  (draft_id, 1, json.dumps(coi, ensure_ascii=False), json.dumps(meta, ensure_ascii=False), ts,
                   user["name"]))
        audit.append(c, draft_id, user, "upload", f"Wgrano plik {source_file} (sha256 {sha256[:12]}…).")
        audit.append(c, draft_id, user, "draft_generated", f"Wygenerowano wersję roboczą „{title}”.", ai_output_ref)
        audit.append(c, draft_id, user, "linters_run", f"Uruchomiono lintery: {len(flags)} flag.")
    return draft_id


def _draft_row(db: Database, draft_id: str):
    rows = db.query("SELECT * FROM drafts WHERE id = ?", (draft_id,))
    return rows[0] if rows else None


def get_draft(db: Database, draft_id: str) -> dict[str, Any] | None:
    d = _draft_row(db, draft_id)
    if d is None:
        return None
    v = db.query("SELECT * FROM draft_versions WHERE draft_id = ? AND version = ?", (draft_id, d["current_version"]))[0]
    return {
        "id": d["id"],
        "status": d["status"],
        "title": d["title"],
        "sourceFile": d["source_file"],
        "createdAt": d["created_at"],
        "updatedAt": d["updated_at"],
        "createdBy": d["created_by"],
        "version": d["current_version"],
        "coi": json.loads(v["coi_json"]),
        "meta": json.loads(v["meta_json"]),
        "flags": [LintFlag.model_validate(f) for f in json.loads(d["flags_json"])],
    }


def list_drafts(db: Database) -> list[dict[str, Any]]:
    out = []
    for d in db.query("SELECT * FROM drafts ORDER BY updated_at DESC"):
        flags = [LintFlag.model_validate(f) for f in json.loads(d["flags_json"])]
        from app.lint import is_handled

        open_ = [f for f in flags if not is_handled(f)]
        out.append({
            "id": d["id"],
            "title": d["title"],
            "status": d["status"],
            "updatedAt": d["updated_at"],
            "sourceFile": d["source_file"],
            "openErrors": sum(f.severity == "error" for f in open_),
            "openWarnings": sum(f.severity == "warning" for f in open_),
        })
    return out


def save_version(db: Database, user: User, draft_id: str, coi: dict, meta: dict, flags: list[LintFlag]) -> int:
    ts = now()
    with db.tx() as c:
        d = c.execute("SELECT current_version FROM drafts WHERE id = ?", (draft_id,)).fetchone()
        version = d["current_version"] + 1
        c.execute("INSERT INTO draft_versions VALUES (?,?,?,?,?,?)",
                  (draft_id, version, json.dumps(coi, ensure_ascii=False), json.dumps(meta, ensure_ascii=False), ts,
                   user["name"]))
        c.execute("UPDATE drafts SET current_version = ?, updated_at = ?, title = ?, flags_json = ? WHERE id = ?",
                  (version, ts, coi.get("title", ""), json.dumps([f.model_dump() for f in flags], ensure_ascii=False),
                   draft_id))
        audit.append(c, draft_id, user, "field_edited", f"Zapisano wersję {version} formularza w edytorze.")
        audit.append(c, draft_id, user, "linters_run", f"Uruchomiono lintery: {len(flags)} flag.")
    return version


def set_flags(db: Database, user: User, draft_id: str, flags: list[LintFlag], *, log_details: str | None = None,
              action: str = "linters_run", ai_output_ref: str | None = None) -> None:
    with db.tx() as c:
        c.execute("UPDATE drafts SET flags_json = ?, updated_at = ? WHERE id = ?",
                  (json.dumps([f.model_dump() for f in flags], ensure_ascii=False), now(), draft_id))
        if log_details:
            audit.append(c, draft_id, user, action, log_details, ai_output_ref)


def publish(db: Database, user: User, draft: dict[str, Any], summary: str, minutes: int) -> dict[str, Any]:
    ts = now()
    form_id = f"form-{draft['id'].removeprefix('draft-')}-v{draft['version']}"
    with db.tx() as c:
        c.execute("INSERT OR REPLACE INTO published_forms VALUES (?,?,?,?,?,?,?,?,?)",
                  (form_id, draft["id"], draft["version"], ts, user["name"],
                   json.dumps(draft["coi"], ensure_ascii=False), json.dumps(draft["meta"], ensure_ascii=False),
                   summary, minutes))
        c.execute("UPDATE drafts SET status = 'published', updated_at = ? WHERE id = ?", (ts, draft["id"]))
        audit.append(c, draft["id"], user, "published", f"Opublikowano wersję {draft['version']} jako {form_id}.")
    return get_published(db, form_id)  # type: ignore[return-value]


def _published(r) -> dict[str, Any]:
    return {
        "id": r["id"],
        "draftId": r["draft_id"],
        "version": r["version"],
        "publishedAt": r["published_at"],
        "publishedBy": r["published_by"],
        "coi": json.loads(r["coi_json"]),
        "meta": json.loads(r["meta_json"]),
        "summary": r["summary"],
        "estimatedMinutes": r["estimated_minutes"],
    }


def list_published(db: Database) -> list[dict[str, Any]]:
    return [_published(r) for r in db.query("SELECT * FROM published_forms ORDER BY published_at DESC")]


def get_published(db: Database, form_id: str) -> dict[str, Any] | None:
    rows = db.query("SELECT * FROM published_forms WHERE id = ?", (form_id,))
    return _published(rows[0]) if rows else None


def _app(r) -> dict[str, Any]:
    out = {
        "id": r["id"],
        "formId": r["form_id"],
        "formTitle": r["form_title"],
        "status": r["status"],
        "updatedAt": r["updated_at"],
        "values": json.loads(r["values_json"]),
    }
    if r["confirmation_no"]:
        out["confirmationNo"] = r["confirmation_no"]
    return out


def list_applications(db: Database, owner_id: str) -> list[dict[str, Any]]:
    return [_app(r) for r in db.query("SELECT * FROM applications WHERE owner_id = ? ORDER BY updated_at DESC",
                                      (owner_id,))]


def get_application(db: Database, app_id: str, owner_id: str) -> dict[str, Any] | None:
    rows = db.query("SELECT * FROM applications WHERE id = ? AND owner_id = ?", (app_id, owner_id))
    return _app(rows[0]) if rows else None


def save_application(db: Database, owner_id: str, data: dict[str, Any], app_id: str | None = None) -> dict[str, Any]:
    ts = now()
    app_id = app_id or _uid("app")
    confirmation = data.get("confirmationNo")
    if data["status"] == "sent" and not confirmation:
        confirmation = f"UPO/{ts[:4]}/{ts[5:7]}/{random.randint(0, 999_999):06d}"  # makieta UPO
    with db.tx() as c:
        c.execute(
            "INSERT INTO applications VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status = excluded.status,"
            " updated_at = excluded.updated_at, values_json = excluded.values_json,"
            " confirmation_no = excluded.confirmation_no WHERE applications.owner_id = excluded.owner_id",
            (app_id, owner_id, data["formId"], data["formTitle"], data["status"], ts,
             json.dumps(data.get("values", {}), ensure_ascii=False), confirmation),
        )
    return get_application(db, app_id, owner_id)  # type: ignore[return-value]
