import hashlib
import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    issuer TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    coi TEXT NOT NULL,
    meta TEXT NOT NULL,
    flags TEXT NOT NULL,
    extras TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resolutions (
    draft_id TEXT NOT NULL,
    flag_id TEXT NOT NULL,
    action TEXT NOT NULL,
    justification TEXT,
    by_name TEXT NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (draft_id, flag_id)
);
CREATE TABLE IF NOT EXISTS audit (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    draft_id TEXT NOT NULL,
    at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    ai_ref TEXT,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS published (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    published_at TEXT NOT NULL,
    published_by TEXT NOT NULL,
    title TEXT NOT NULL,
    issuer TEXT NOT NULL,
    source_file TEXT NOT NULL,
    coi TEXT NOT NULL,
    meta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    form_title TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    answers TEXT NOT NULL,
    confirmation_no TEXT
);
"""
GENESIS = "0" * 64


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class Store:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL" if self.path != ":memory:" else "PRAGMA journal_mode=MEMORY")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.executescript(SCHEMA)

    @contextmanager
    def tx(self):
        with self.lock:
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise

    def create_draft(self, *, title: str, source_file: str, sha256: str, issuer: str, user_id: str, coi: dict, meta: dict, flags: list[dict], extras: dict) -> str:
        draft_id = new_id("draft")
        stamp = now()
        with self.tx() as db:
            db.execute(
                "INSERT INTO drafts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (draft_id, title, "review", source_file, sha256, issuer, 1, stamp, stamp, user_id, json.dumps(coi, ensure_ascii=False), json.dumps(meta, ensure_ascii=False), json.dumps(flags, ensure_ascii=False), json.dumps(extras, ensure_ascii=False)),
            )
        return draft_id

    @staticmethod
    def _draft(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        data = dict(row)
        for key in ("coi", "meta", "flags", "extras"):
            data[key] = json.loads(data[key])
        return data

    def draft(self, draft_id: str) -> dict | None:
        with self.lock:
            return self._draft(self.conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())

    def drafts(self) -> list[dict]:
        with self.lock:
            rows = self.conn.execute("SELECT * FROM drafts ORDER BY updated_at DESC").fetchall()
        return [self._draft(r) for r in rows]

    def update_draft(self, draft_id: str, **values) -> None:
        values["updated_at"] = now()
        for key in ("coi", "meta", "flags", "extras"):
            if key in values:
                values[key] = json.dumps(values[key], ensure_ascii=False)
        columns = ", ".join(f"{k} = ?" for k in values)
        with self.tx() as db:
            db.execute(f"UPDATE drafts SET {columns} WHERE id = ?", (*values.values(), draft_id))

    def resolutions(self, draft_id: str) -> dict[str, dict]:
        with self.lock:
            rows = self.conn.execute("SELECT * FROM resolutions WHERE draft_id = ?", (draft_id,)).fetchall()
        return {
            r["flag_id"]: {
                "action": r["action"],
                "by": r["by_name"],
                "at": r["at"],
                **({"justification": r["justification"]} if r["justification"] else {}),
            }
            for r in rows
        }

    def resolve(self, draft_id: str, flag_id: str, action: str, justification: str | None, by_name: str) -> dict:
        stamp = now()
        with self.tx() as db:
            db.execute(
                "INSERT INTO resolutions VALUES (?,?,?,?,?,?) ON CONFLICT(draft_id, flag_id) DO UPDATE SET action=excluded.action, justification=excluded.justification, by_name=excluded.by_name, at=excluded.at",
                (draft_id, flag_id, action, justification, by_name, stamp),
            )
        return self.resolutions(draft_id)[flag_id]

    def audit(self, draft_id: str, user_id: str, user_name: str, action: str, details: str, ai_ref: str | None = None) -> dict:
        with self.tx() as db:
            last = db.execute("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1").fetchone()
            prev = last["hash"] if last else GENESIS
            entry = {
                "id": new_id("audit"),
                "draftId": draft_id,
                "at": now(),
                "userId": user_id,
                "userName": user_name,
                "action": action,
                "details": details,
            }
            if ai_ref:
                entry["aiOutputRef"] = ai_ref
            digest = hashlib.sha256((prev + json.dumps(entry, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
            db.execute(
                "INSERT INTO audit (id, draft_id, at, user_id, user_name, action, details, ai_ref, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (entry["id"], draft_id, entry["at"], user_id, user_name, action, details, ai_ref, prev, digest),
            )
        return entry

    @staticmethod
    def _audit_entry(row: sqlite3.Row) -> dict:
        entry = {
            "id": row["id"],
            "draftId": row["draft_id"],
            "at": row["at"],
            "userId": row["user_id"],
            "userName": row["user_name"],
            "action": row["action"],
            "details": row["details"],
        }
        if row["ai_ref"]:
            entry["aiOutputRef"] = row["ai_ref"]
        return entry

    def audit_trail(self, draft_id: str | None = None) -> list[dict]:
        with self.lock:
            if draft_id:
                rows = self.conn.execute("SELECT * FROM audit WHERE draft_id = ? ORDER BY seq DESC", (draft_id,)).fetchall()
            else:
                rows = self.conn.execute("SELECT * FROM audit ORDER BY seq DESC").fetchall()
        return [self._audit_entry(r) for r in rows]

    def verify_audit(self) -> bool:
        prev = GENESIS
        with self.lock:
            rows = self.conn.execute("SELECT * FROM audit ORDER BY seq").fetchall()
        for row in rows:
            entry = self._audit_entry(row)
            digest = hashlib.sha256((prev + json.dumps(entry, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
            if row["prev_hash"] != prev or row["hash"] != digest:
                return False
            prev = digest
        return True

    def publish(self, draft: dict, by_name: str) -> dict:
        form_id = new_id("form")
        stamp = now()
        with self.tx() as db:
            db.execute(
                "INSERT INTO published VALUES (?,?,?,?,?,?,?,?,?,?)",
                (form_id, draft["id"], draft["version"], stamp, by_name, draft["title"], draft["issuer"], draft["source_file"], json.dumps(draft["coi"], ensure_ascii=False), json.dumps(draft["meta"], ensure_ascii=False)),
            )
            db.execute("UPDATE drafts SET status = 'published', updated_at = ? WHERE id = ?", (stamp, draft["id"]))
        return self.published(form_id)

    @staticmethod
    def _published(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        data = dict(row)
        data["coi"] = json.loads(data["coi"])
        data["meta"] = json.loads(data["meta"])
        return data

    def published(self, form_id: str) -> dict | None:
        with self.lock:
            return self._published(self.conn.execute("SELECT * FROM published WHERE id = ?", (form_id,)).fetchone())

    def published_forms(self) -> list[dict]:
        with self.lock:
            rows = self.conn.execute(
                "SELECT * FROM published p WHERE version = (SELECT MAX(version) FROM published q WHERE q.draft_id = p.draft_id) ORDER BY published_at DESC"
            ).fetchall()
        return [self._published(r) for r in rows]

    def save_application(self, *, app_id: str | None, form_id: str, form_title: str, status: str, user_id: str, answers: dict) -> dict:
        stamp = now()
        app_id = app_id or new_id("app")
        confirmation = None
        if status == "sent":
            confirmation = f"UPO-{datetime.now(UTC):%Y}-{uuid.uuid4().int % 10**6:06d}"
        with self.tx() as db:
            db.execute(
                "INSERT INTO applications VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, answers=excluded.answers, confirmation_no=COALESCE(applications.confirmation_no, excluded.confirmation_no)",
                (app_id, form_id, form_title, status, stamp, user_id, json.dumps(answers, ensure_ascii=False), confirmation),
            )
        return self.application(app_id)

    @staticmethod
    def _application(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        data = {
            "id": row["id"],
            "formId": row["form_id"],
            "formTitle": row["form_title"],
            "status": row["status"],
            "updatedAt": row["updated_at"],
            "values": json.loads(row["answers"]),
            "userId": row["user_id"],
        }
        if row["confirmation_no"]:
            data["confirmationNo"] = row["confirmation_no"]
        return data

    def application(self, app_id: str) -> dict | None:
        with self.lock:
            return self._application(self.conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone())

    def applications(self, user_id: str) -> list[dict]:
        with self.lock:
            rows = self.conn.execute("SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)).fetchall()
        return [self._application(r) for r in rows]


@lru_cache
def get_store() -> Store:
    return Store(get_settings().db_path)
