"""Heurystyki, builder, parser ustaw i LLM (z atrapą Ollamy – bez sieci)."""

import json

import httpx
import pytest

from app.coi.builder import build_coi, slugify
from app.coi.models import FieldType
from app.coi.validator import validate_coi
from app.config import Settings
from app.extract.ir import DocumentIR, append_lines
from app.legal.index import LegalIndex
from app.legal.parser import parse_statute
from app.understand import llm as llm_mod
from app.understand.heuristics import understand
from app.understand.llm import LlmClient, refine_with_llm
from tests.conftest import FIXTURES

FORM_TEXT = """Urząd Gminy Stawiguda
Wniosek o zwrot opłaty skarbowej
1. Instrukcja wypełnienia dokumentu
1. WYPEŁNIJ WIELKIMI LITERAMI.
2. Dane wnioskodawcy
2.1. Dane identyfikacyjne
Nazwa /Imię i nazwisko
NIP
2.2. Dane kontaktowe wnioskodawcy (dane kontaktowe nie są obowiązkowe)
Numer telefonu
3. Informacje o opłacie skarbowej
Data uiszczenia opłaty - -
DD-MM-RRRR
Wysokość opłaty
4. Informacje dotyczące sposobu zwrotu opłaty skarbowej (postaw „x” w wybranym polu)
Gotówką w kasie organu
Przelewem na rachunek w banku
Jeśli wybierzesz tę formę, wpisz poniżej nr rachunku i dane jego właściciela
Nr rachunku
5. Podstawa prawna
Art. 9 ustawy z dnia 16 listopada 2006 r. o opłacie skarbowej
6. Załączniki (postaw „x” w wybranym polu)
1. Dowód uiszczenia opłaty skarbowej za pełnomocnictwo
7. Data i podpis wnioskodawcy
Podpis"""


@pytest.fixture
def doc() -> DocumentIR:
    ir = DocumentIR("pdf")
    append_lines(ir, FORM_TEXT.splitlines())
    return ir


def fields_by_label(form) -> dict:
    return {f.label: f for f in form.all_fields()}


def test_understand_reads_title_office_and_legal_basis(doc):
    form = understand(doc)

    assert form.title == "Wniosek o zwrot opłaty skarbowej"
    assert form.office == "Urząd Gminy Stawiguda"
    assert form.legal_basis_text == ["Art. 9 ustawy z dnia 16 listopada 2006 r. o opłacie skarbowej"]


def test_understand_replaces_applicant_data_with_standard_blocks(doc):
    form = understand(doc)

    labels = set(fields_by_label(form))
    assert not {"NIP", "Numer telefonu", "Nazwa /Imię i nazwisko"} & labels
    assert {"applicant", "contact"} <= set(form.standard_blocks)


def test_understand_detects_types_choice_and_condition(doc):
    f = fields_by_label(understand(doc))

    assert f["Data uiszczenia opłaty"].type == FieldType.DATEPICKER
    assert f["Wysokość opłaty"].type == FieldType.NUMBER
    choice = f["Informacje dotyczące sposobu zwrotu opłaty skarbowej"]
    assert choice.type == FieldType.RADIO
    assert choice.options == ["Gotówką w kasie organu", "Przelewem na rachunek w banku"]
    account = f["Numer rachunku bankowego"]
    assert account.condition is not None
    assert (account.condition.field_key, account.condition.equals) == (choice.key, "Przelewem na rachunek w banku")


def test_understand_attachments_are_optional_file_uploaders(doc):
    f = fields_by_label(understand(doc))["Dowód uiszczenia opłaty skarbowej za pełnomocnictwo"]

    assert (f.type, f.required) == (FieldType.FILE_UPLOADER, False)


def test_understand_drops_instructions_and_signature(doc):
    labels = " ".join(fields_by_label(understand(doc)))

    assert "WIELKIMI" not in labels.upper() or "Wypełnij" not in labels
    assert "Podpis" not in labels


def test_build_coi_is_deterministic_and_valid(doc):
    form = understand(doc)

    a, b = build_coi(form, seed="x"), build_coi(form, seed="x")

    assert a.coi == b.coi
    assert [i for i in validate_coi(a.coi) if i.severity == "error"] == []
    assert a.coi["tabs"][0]["title"] == "Dane"
    assert a.coi["tabs"][-1]["type"] == "FINISH"


def test_build_coi_sets_office_name_in_standard_block(doc):
    coi = build_coi(understand(doc)).coi

    office = [c["field"] for q in coi["tabs"][0]["questions"] for c in q["field"]["repeatingSectionGrid"]
              if c["field"]["techName"] == "nazwa_urzedu"][0]
    assert office["defaultValue"] == "Urząd Gminy Stawiguda"


def test_build_coi_empty_form_gets_placeholder_page():
    from app.understand.form_ir import FormIR

    coi = build_coi(FormIR("Wniosek")).coi

    assert [i for i in validate_coi(coi) if i.severity == "error"] == []


@pytest.mark.parametrize(("text", "slug"), [("Imię i nazwisko", "imie_i_nazwisko"), ("Kod pocztowy", "kod_pocztowy"),
                                            ("2. Źródło", "pole_2_zrodlo"), ("", "pole")])
def test_slugify_removes_polish_characters(text, slug):
    assert slugify(text) == slug


def test_parse_statute_splits_articles_paragraphs_and_points():
    chunks = parse_statute((FIXTURES / "ustawa_testowa.txt").read_text(), "t")

    units = [c.unit for c in chunks]
    assert units == ["art. 1 ust. 1", "art. 1 ust. 2", "art. 2", "art. 2 pkt 1", "art. 2 pkt 2"]
    assert chunks[0].act.startswith("Ustawa testowa")


def test_legal_index_finds_relevant_chunk_and_exact_sentence():
    index = LegalIndex(parse_statute((FIXTURES / "ustawa_testowa.txt").read_text(), "t"))

    (hit,) = index.search("numer rachunku bankowego", k=1)

    assert hit.chunk.unit == "art. 1 ust. 1"
    assert index.find_quote(hit.quote)[0] == 100.0


# ------------------------------------------------------------------ LLM z atrapą Ollamy


def _ollama_ok(payload: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "qwen3:4b", "digest": "abcdef1234567890"}]})
        body = json.loads(request.content)
        assert body["options"] == {"temperature": 0, "seed": 2026}
        assert body["format"]["type"] == "object"
        return httpx.Response(200, json={"message": {"content": json.dumps(payload)}})

    return handler


@pytest.fixture
def mock_http(monkeypatch):
    def install(handler):
        transport = httpx.MockTransport(handler)
        monkeypatch.setattr(llm_mod.httpx, "post", lambda url, **kw: httpx.Client(transport=transport).post(url, **kw))
        monkeypatch.setattr(llm_mod.httpx, "get", lambda url, **kw: httpx.Client(transport=transport).get(url, **kw))

    return install


def test_refine_with_llm_applies_plain_titles_and_records_model(doc, mock_http):
    mock_http(_ollama_ok({"sectionTitle": "Opłata", "fields": [
        {"label": "Data uiszczenia opłaty", "plainTitle": "Kiedy zapłacono?", "type": "DATEPICKER",
         "required": True, "options": []}]}))
    form = understand(doc)

    refined = refine_with_llm(form, LlmClient(Settings(llm_enabled=True)))

    assert "Kiedy zapłacono?" in {f.label for f in refined.all_fields()}
    assert refined.ai_output_ref.startswith("qwen3:4b@abcdef123456#")


def test_refine_with_llm_timeout_keeps_heuristics(doc, mock_http):
    def boom(request):
        raise httpx.ReadTimeout("timeout")

    mock_http(boom)
    form = understand(doc)
    before = [f.label for f in form.all_fields()]

    refined = refine_with_llm(form, LlmClient(Settings(llm_enabled=True)))

    assert [f.label for f in refined.all_fields()] == before
    assert refined.notes and all(f.needs_review for f in refined.all_fields())
    assert [i for i in validate_coi(build_coi(refined).coi) if i.severity == "error"] == []
