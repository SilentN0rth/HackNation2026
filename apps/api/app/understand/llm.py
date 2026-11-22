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


def _eden_key() -> str:
    return get_settings().edenai_api_key.get_secret_value()


def _model_name() -> str:
    settings = get_settings()
    return settings.edenai_model if settings.llm_provider == "edenai" else settings.llm_model


def available() -> bool:
    settings = get_settings()
    if not settings.llm_enabled:
        return False
    if settings.llm_provider == "edenai":
        # Bez zapytania do sieci: każde kosztuje z budżetu zespołu.
        return bool(_eden_key())
    try:
        return httpx.get(f"{settings.ollama_url}/api/tags", timeout=2).is_success
    except httpx.HTTPError:
        return False


def _ask_ollama(messages: list[dict]) -> dict:
    settings = get_settings()
    payload = {
        "model": settings.llm_model,
        "stream": False,
        "format": SCHEMA,
        "options": {"temperature": 0, "seed": 7},
        "messages": messages,
    }
    response = httpx.post(f"{settings.ollama_url}/api/chat", json=payload, timeout=settings.llm_timeout_s)
    response.raise_for_status()
    return json.loads(response.json()["message"]["content"])


def _ask_edenai(messages: list[dict]) -> dict:
    settings = get_settings()
    payload = {
        "model": settings.edenai_model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": messages,
    }
    response = httpx.post(
        f"{settings.edenai_url.rstrip('/')}/chat/completions",
        json=payload,
        headers={"Authorization": f"Bearer {_eden_key()}"},
        timeout=settings.llm_timeout_s,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    if content.startswith("```"):
        content = content.strip("`").removeprefix("json").strip()
    return json.loads(content)


def refine(form: FormIR) -> str | None:
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    fields = [f for page in form.pages for s in page.sections for f in s.fields]
    if not fields:
        return None
    eden = settings.llm_provider == "edenai"
    if eden and not _eden_key():
        form.warnings.append("Brak klucza EDENAI_API_KEY. Etykiety pochodzą z reguł.")
        return None
    messages = [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps([{"key": f.key, "title": f.title} for f in fields], ensure_ascii=False)},
    ]
    try:
        content = (_ask_edenai if eden else _ask_ollama)(messages)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        # Treść błędu bywa długa i zawiera adres, więc w logu zostaje sam typ.
        log.warning("Model językowy niedostępny, zostają etykiety z heurystyk: %s", type(exc).__name__)
        form.warnings.append("Model językowy był niedostępny. Etykiety pochodzą z reguł.")
        return None
    by_key = {f.key: f for f in fields}
    for item in content.get("fields", []):
        target = by_key.get(item.get("key"))
        title = (item.get("title") or "").strip()
        if target and 2 <= len(title) <= 120:
            target.title = title
    return _model_name()
