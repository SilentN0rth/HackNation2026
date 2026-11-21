"""Audit Trail – tylko do dopisywania, z łańcuchem hashy.

hash_n = sha256(hash_{n-1} + kanoniczny JSON wpisu). Zmiana dowolnego wpisu (np. bezpośrednio w pliku bazy)
psuje łańcuch od tego miejsca – wykrywa to `verify_chain`.
"""

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from app.store.db import Database

GENESIS = "0" * 64


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _entry_hash(prev: str, entry: dict[str, Any]) -> str:
    payload = json.dumps(entry, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256((prev + payload).encode()).hexdigest()


def append(conn: sqlite3.Connection, draft_id: str, user: dict[str, str], action: str, details: str,
           ai_output_ref: str | None = None) -> dict[str, Any]:
    row = conn.execute("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
    prev = row["hash"] if row else GENESIS
    entry = {
        "id": f"a-{uuid.uuid4().hex[:12]}",
        "draftId": draft_id,
        "at": now(),
        "userId": user["id"],
        "userName": user["name"],
        "action": action,
        "details": details,
        "aiOutputRef": ai_output_ref,
    }
    h = _entry_hash(prev, entry)
    conn.execute(
        "INSERT INTO audit_log (id, draft_id, at, user_id, user_name, action, details, ai_output_ref, prev_hash, hash)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (entry["id"], draft_id, entry["at"], user["id"], user["name"], action, details, ai_output_ref, prev, h),
    )
    return entry


def _row_entry(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"],
        "draftId": r["draft_id"],
        "at": r["at"],
        "userId": r["user_id"],
        "userName": r["user_name"],
        "action": r["action"],
        "details": r["details"],
        "aiOutputRef": r["ai_output_ref"],
    }


def list_entries(db: Database, draft_id: str | None = None) -> list[dict[str, Any]]:
    if draft_id:
        rows = db.query("SELECT * FROM audit_log WHERE draft_id = ? ORDER BY seq DESC", (draft_id,))
    else:
        rows = db.query("SELECT * FROM audit_log ORDER BY seq DESC")
    out = []
    for r in rows:
        e = _row_entry(r)
        if e["aiOutputRef"] is None:
            del e["aiOutputRef"]
        out.append(e)
    return out


def verify_chain(db: Database) -> tuple[bool, int | None]:
    """(czy łańcuch nienaruszony, numer pierwszego złego wpisu)."""
    prev = GENESIS
    for r in db.query("SELECT * FROM audit_log ORDER BY seq"):
        if r["prev_hash"] != prev or _entry_hash(prev, _row_entry(r)) != r["hash"]:
            return False, r["seq"]
        prev = r["hash"]
    return True, None
