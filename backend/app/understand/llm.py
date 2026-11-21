"""[3b] LLM (Ollama, lokalnie) – tylko poprawa „Przedmiotu wniosku”, sekcja po sekcji.

Model dostaje fragment dokumentu i propozycję heurystyk; zwraca MAŁY model pośredni (JSON Schema w `format`,
structured outputs). UUID, siatkę, JSONatę i flow zawsze robi kod. Timeout albo błąd → zostaje wynik heurystyk
(tryb bez LLM nadal zwraca poprawny JSON COI).
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import httpx

from app.coi.models import FieldType
from app.config import Settings
from app.understand.form_ir import ConditionIR, FieldIR, FormIR, SectionIR

log = logging.getLogger(__name__)
PROMPTS = Path(__file__).parent / "prompts"
SEED = 2026
ALLOWED_TYPES = ["TEXT_FIELD", "TEXTAREA", "NUMBER", "DATEPICKER", "SELECT", "RADIO", "CHECKBOX", "FILE_UPLOADER"]

SECTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "sectionTitle": {"type": "string"},
        "fields": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "etykieta z dokumentu"},
                    "plainTitle": {"type": "string", "description": "krótkie pytanie prostym językiem, max 8 słów"},
                    "type": {"type": "string", "enum": ALLOWED_TYPES},
                    "required": {"type": "boolean"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "description": {"type": "string"},
                    "showIfLabel": {"type": "string", "description": "etykieta pola wyboru, od którego zależy"},
                    "showIfValue": {"type": "string"},
                },
                "required": ["label", "plainTitle", "type", "required", "options"],
            },
        },
    },
    "required": ["sectionTitle", "fields"],
}

RELEVANCE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"relevant": {"type": "boolean"}, "reason": {"type": "string"}},
    "required": ["relevant", "reason"],
}


@cache
def _prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text()


@dataclass
class LlmClient:
    settings: Settings

    @property
    def enabled(self) -> bool:
        return self.settings.llm_enabled

    def _digest(self) -> str:
        try:
            r = httpx.get(f"{self.settings.ollama_url}/api/tags", timeout=3)
            for m in r.json().get("models", []):
                if m.get("name") == self.settings.llm_model or m.get("model") == self.settings.llm_model:
                    return str(m.get("digest", ""))[:12]
        except (httpx.HTTPError, ValueError):
            pass
        return "unknown"

    def health(self) -> bool:
        if not self.enabled:
            return False
        try:
            return httpx.get(f"{self.settings.ollama_url}/api/tags", timeout=2).status_code == 200
        except httpx.HTTPError:
            return False

    def chat_json(self, system: str, user: str, schema: dict[str, Any]) -> tuple[dict[str, Any], str]:
        """Zwraca (odpowiedź JSON, aiOutputRef = model@digest#sha256(prompt))."""
        prompt_hash = hashlib.sha256((system + "\n" + user).encode()).hexdigest()[:16]
        body = {
            "model": self.settings.llm_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "format": schema,
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "seed": SEED},
        }
        r = httpx.post(f"{self.settings.ollama_url}/api/chat", json=body, timeout=self.settings.llm_timeout_s)
        r.raise_for_status()
        content = r.json()["message"]["content"]
        return json.loads(content), f"{self.settings.llm_model}@{self._digest()}#{prompt_hash}"


def _section_payload(section: SectionIR) -> str:
    lines = [f.source for f in section.fields if f.source]
    proposal = [{"label": f.label, "type": str(f.type), "required": f.required, "options": f.options}
                for f in section.fields]
    return json.dumps({"sectionTitle": section.title, "documentLines": lines, "heuristicProposal": proposal},
                      ensure_ascii=False)


def _apply(section: SectionIR, out: dict[str, Any]) -> None:
    by_label = {f.label.lower(): f for f in section.fields}
    new_fields: list[FieldIR] = []
    for i, item in enumerate(out.get("fields", [])):
        if item.get("type") not in ALLOWED_TYPES:
            continue
        old = by_label.get(str(item.get("label", "")).lower())
        f = FieldIR(
            key=old.key if old else f"{section.fields[0].key if section.fields else 'llm'}_{i}",
            label=(item.get("plainTitle") or item.get("label") or "").strip()[:200],
            type=FieldType(item["type"]),
            required=bool(item.get("required", True)),
            options=[str(o).strip() for o in item.get("options", []) if str(o).strip()],
            description=str(item.get("description", ""))[:500],
            validators=old.validators if old else [],
            confidence=old.confidence if old else 0.8,
            source=old.source if old else "",
            legal_basis=old.legal_basis if old else None,
        )
        if not f.label:
            continue
        if item.get("showIfLabel") and item.get("showIfValue"):
            f.condition = ConditionIR(f"label:{item['showIfLabel'].lower()}", item["showIfValue"])
        new_fields.append(f)
    if not new_fields:
        return
    # warunki po etykiecie → po kluczu pola w tej sekcji
    keys = {f.label.lower(): f.key for f in new_fields}
    for f in new_fields:
        if f.condition and f.condition.field_key.startswith("label:"):
            target = keys.get(f.condition.field_key[6:])
            f.condition = ConditionIR(target, f.condition.equals) if target else None
    title = str(out.get("sectionTitle", "")).strip()
    if title:
        section.title = title[:120]
    section.fields = new_fields


def refine_with_llm(form: FormIR, client: LlmClient) -> FormIR:
    """Sekcja po sekcji; każda porażka zostawia wynik heurystyk dla tej sekcji."""
    if not client.enabled:
        return form
    system = _prompt("section_system")
    refs: list[str] = []
    for page in form.pages:
        for section in page.sections:
            try:
                out, ref = client.chat_json(system, _section_payload(section), SECTION_SCHEMA)
                _apply(section, out)
                refs.append(ref)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
                log.warning("LLM: sekcja %r pozostaje z heurystyk (%s)", section.title, e)
                for f in section.fields:
                    f.needs_review = True
                form.notes.append(f"LLM niedostępny dla sekcji „{section.title}” – użyto heurystyk.")
    if refs:
        form.ai_output_ref = refs[0].split("#")[0] + "#" + hashlib.sha256("".join(refs).encode()).hexdigest()[:16]
    return form


def citation_relevant(client: LlmClient, field_label: str, quote: str) -> tuple[bool, str, str] | None:
    """Czy cytat uzasadnia zbieranie pola? None, gdy LLM niedostępny."""
    if not client.enabled:
        return None
    try:
        out, ref = client.chat_json(
            _prompt("relevance_system"),
            json.dumps({"field": field_label, "quote": quote}, ensure_ascii=False),
            RELEVANCE_SCHEMA,
        )
        return bool(out["relevant"]), str(out.get("reason", ""))[:300], ref
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None
