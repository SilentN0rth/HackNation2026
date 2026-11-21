import json
import logging

import httpx

from app.config import get_settings
from app.understand.model import FormIR

log = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "fields": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"key": {"type": "string"}, "title": {"type": "string"}},
                "required": ["key", "title"],
            },
        }
    },
    "required": ["fields"],
}

PROMPT = (
    "Jesteś redaktorem prostego języka w polskiej administracji. Dla każdego pola formularza "
    "zaproponuj krótką, zrozumiałą etykietę (do 8 słów), zwracając się bezpośrednio do obywatela. "
    "Nie zmieniaj znaczenia, nie dodawaj nowych pól, zachowaj klucze. Odpowiedz wyłącznie JSON-em."
)


def available() -> bool:
    settings = get_settings()
    if not settings.llm_enabled:
        return False
    try:
        return httpx.get(f"{settings.ollama_url}/api/tags", timeout=2).is_success
    except httpx.HTTPError:
        return False


def refine(form: FormIR) -> str | None:
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    fields = [f for page in form.pages for s in page.sections for f in s.fields]
    if not fields:
        return None
    payload = {
        "model": settings.llm_model,
        "stream": False,
        "format": SCHEMA,
        "options": {"temperature": 0, "seed": 7},
        "messages": [
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": json.dumps([{"key": f.key, "title": f.title} for f in fields], ensure_ascii=False)},
        ],
    }
    try:
        response = httpx.post(f"{settings.ollama_url}/api/chat", json=payload, timeout=settings.llm_timeout_s)
        response.raise_for_status()
        content = json.loads(response.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Model językowy niedostępny, zostają etykiety z heurystyk: %s", exc)
        form.warnings.append("Model językowy był niedostępny. Etykiety pochodzą z reguł.")
        return None
    by_key = {f.key: f for f in fields}
    for item in content.get("fields", []):
        target = by_key.get(item.get("key"))
        title = (item.get("title") or "").strip()
        if target and 2 <= len(title) <= 120:
            target.title = title
    return settings.llm_model
