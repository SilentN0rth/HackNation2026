"""Ścieżka modelu językowego (Ollama): poprawia tylko etykiety i nie psuje wyniku, gdy model zawiedzie."""

import json

import httpx
import pytest

from app.config import get_settings
from app.understand import llm
from app.understand.model import FieldIR, FormIR, PageIR, SectionIR


@pytest.fixture(autouse=True)
def enabled(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    # Zmienne środowiska wygrywają z lokalnym .env, więc testy nie zależą od wybranego tam dostawcy.
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("EDENAI_API_KEY", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def form() -> FormIR:
    fields = [FieldIR("a", "Proszę podać numer PESEL wnioskodawcy", "TEXT_FIELD"), FieldIR("b", "Data", "DATEPICKER")]
    return FormIR("Wniosek", "Urząd", [PageIR("S", [SectionIR("A", fields)])])


def reply(content: dict) -> httpx.Response:
    return httpx.Response(200, json={"message": {"content": json.dumps(content)}}, request=httpx.Request("POST", "http://x"))


def test_refine_updates_only_known_keys(monkeypatch, form):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: reply({"fields": [{"key": "a", "title": "Twój PESEL"}, {"key": "zzz", "title": "Obce"}]}))
    assert llm.refine(form) == get_settings().llm_model
    titles = [f.title for f in form.pages[0].sections[0].fields]
    assert titles == ["Twój PESEL", "Data"]


def test_refine_rejects_too_short_or_long_titles(monkeypatch, form):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: reply({"fields": [{"key": "a", "title": "x"}, {"key": "b", "title": "y" * 200}]}))
    llm.refine(form)
    assert form.pages[0].sections[0].fields[0].title.startswith("Proszę")


def test_refine_falls_back_when_model_is_down(monkeypatch, form):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "post", boom)
    assert llm.refine(form) is None and form.warnings and form.pages[0].sections[0].fields[0].title.startswith("Proszę")


def test_refine_falls_back_on_garbage(monkeypatch, form):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(200, json={"message": {"content": "nie json"}}, request=httpx.Request("POST", "http://x")))
    assert llm.refine(form) is None


def test_disabled_model_makes_no_request(monkeypatch, form):
    monkeypatch.setenv("LLM_ENABLED", "false")
    get_settings.cache_clear()
    monkeypatch.setattr(httpx, "post", lambda *a, **k: pytest.fail("nie powinno wołać modelu"))
    assert llm.refine(form) is None


def eden_reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]}, request=httpx.Request("POST", "http://x"))


@pytest.fixture
def eden(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "edenai")
    monkeypatch.setenv("EDENAI_API_KEY", "test-key")
    get_settings.cache_clear()


def test_edenai_sends_bearer_key_and_updates_titles(monkeypatch, form, eden):
    seen = {}

    def post(url, **kwargs):
        seen.update(url=url, **kwargs)
        return eden_reply('```json\n{"fields": [{"key": "a", "title": "Twój PESEL"}]}\n```')

    monkeypatch.setattr(httpx, "post", post)
    assert llm.refine(form) == get_settings().edenai_model
    assert seen["url"].endswith("/v3/chat/completions")
    assert seen["headers"] == {"Authorization": "Bearer test-key"}
    assert form.pages[0].sections[0].fields[0].title == "Twój PESEL"


def test_edenai_without_key_makes_no_request(monkeypatch, form, eden):
    monkeypatch.setenv("EDENAI_API_KEY", "")
    get_settings.cache_clear()
    monkeypatch.setattr(httpx, "post", lambda *a, **k: pytest.fail("nie powinno wołać modelu"))
    assert llm.refine(form) is None and form.warnings
    assert llm.available() is False


def test_edenai_falls_back_on_http_error_and_hides_key(monkeypatch, form, eden, caplog):
    def post(*a, **k):
        return httpx.Response(401, request=httpx.Request("POST", "http://x"))

    monkeypatch.setattr(httpx, "post", post)
    assert llm.refine(form) is None and form.warnings
    assert "test-key" not in caplog.text
