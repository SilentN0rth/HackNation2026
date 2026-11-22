"""Heurystyki dla złożonych formularzy: nagłówki z etykiet pól, długie opcje i zgody jako sekcja zgód."""

import pytest

from app.coi import builder
from app.coi.quality import quality
from app.coi.validator import errors
from app.coi.walk import leaves
from app.extract.ir import Document
from app.mapping.frontend import consent_text, from_frontend, to_frontend
from app.understand.heuristics import _label_like, understand
from app.understand.model import FieldIR, FormIR, PageIR, SectionIR

LONG_CONSENT = (
    "Wyrażam zgodę na przetwarzanie moich danych osobowych zawartych we wniosku w celu jego rozpatrzenia "
    "oraz przekazania do dalszego procedowania przez właściwą komisję."
)
LONG_STATEMENT = (
    "Oświadczam, że zapoznałem się z regulaminem przyznawania świadczeń i akceptuję jego warunki "
    "oraz zobowiązuję się do niezwłocznego informowania o zmianach."
)


def document(*lines: str) -> Document:
    doc = Document(kind="docx")
    for text in lines:
        doc.add(text)
    return doc


def fields_of(form: FormIR) -> list[FieldIR]:
    return [f for page in form.pages for s in page.sections for f in s.fields]


# --- jednostkowe ------------------------------------------------------------------------------------


@pytest.mark.parametrize("text", ["PESEL", "TAK NIE", "Tak", "NIP", "Nie"])
def test_short_field_labels_are_label_like(text):
    assert _label_like(text)


def test_real_headings_are_not_label_like():
    assert not _label_like("Szczegóły dotyczące zdarzenia")


def test_consent_html_is_escaped():
    html = builder._consent_html("Zgoda <b>& więcej</b>")
    assert "&lt;b&gt;&amp; więcej&lt;/b&gt;" in html and "<b>" not in html


def test_consent_text_strips_markup_and_entities():
    assert consent_text("<html><body><p>Zgoda&nbsp;na <a href='x'>klauzulę</a></p></body></html>") == "Zgoda na klauzulę"


# --- heurystyki na dokumencie ------------------------------------------------------------------------


def test_label_in_capitals_does_not_open_a_page():
    form = understand(document("Wniosek o coś", "1. Dane sprawy", "PESEL", "Imię i nazwisko ........", "Opis zdarzenia ........"))
    assert "pesel" not in {p.title.lower() for p in form.pages}


def test_long_sentences_are_not_turned_into_options():
    doc = document("Wniosek o coś", "1. Zgody", "Imię i nazwisko kandydata", LONG_CONSENT, LONG_STATEMENT)
    for item in fields_of(understand(doc)):
        if item.type != "CONSENT_SECTION":
            assert all(len(o) <= 120 for o in item.options), item.title


def test_long_statement_becomes_consent_section_not_checkbox():
    form = understand(document("Wniosek o coś", "1. Sprawa", "Opis sprawy ........", LONG_STATEMENT))
    types = [f.type for f in fields_of(form)]
    assert "CONSENT_SECTION" in types and "CHECKBOX" not in types


def test_consent_section_keeps_full_text():
    form = understand(document("Wniosek o coś", "1. Sprawa", "Opis sprawy ........", LONG_CONSENT))
    consent = next(f for f in fields_of(form) if f.type == "CONSENT_SECTION")
    assert any("przetwarzanie moich danych osobowych" in o for o in consent.options)


# --- builder i mapowanie dla obywatela -----------------------------------------------------------------


@pytest.fixture
def with_consents() -> tuple[dict, dict]:
    consent = FieldIR("c", "", "CONSENT_SECTION", required=False, options=[LONG_CONSENT, LONG_STATEMENT])
    page = PageIR("Zgody", [SectionIR("Zgody", [FieldIR("a", "Opis sprawy", "TEXTAREA"), consent])])
    return builder.build(FormIR("Wniosek o coś", "Urząd Gminy Testowo", [page]))


def test_builder_creates_valid_required_consents(with_consents):
    coi, _ = with_consents
    assert errors(coi) == []
    configs = [i.field["consentSectionConfig"] for i in leaves(coi) if i.field["type"] == "CONSENT_SECTION"]
    config = next(c for c in configs if len(c["consents"]) == 2 and "regulaminem" in c["consents"][1]["description"])
    assert [c["required"] for c in config["consents"]] == [True, True] and config["selectAllEnabled"] is True


def test_generated_consents_pass_quality_checks(with_consents):
    assert quality(with_consents[0]) == []


def test_citizen_sees_every_consent_as_required_checkbox(with_consents):
    coi, meta = with_consents
    schema = to_frontend(coi, meta, schema_id="s", version=1, issuer="U", source_file="x.pdf")
    boxes = [f for p in schema["pages"] for f in p["fields"] if f["type"] == "checkbox" and "#" in f["id"]]
    assert len(boxes) == 3  # dwie zgody formularza + zgoda ze standardowej strony kontaktu
    assert all(b["required"] for b in boxes) and any("przetwarzanie moich danych" in b["label"] for b in boxes)


def test_editor_roundtrip_keeps_consent_sections(with_consents):
    coi, meta = with_consents
    schema = to_frontend(coi, meta, schema_id="s", version=1, issuer="U", source_file="x.pdf")
    back, _ = from_frontend(coi, meta, schema)
    assert errors(back) == []
    assert sum(1 for i in leaves(back) if i.field["type"] == "CONSENT_SECTION") == 2
