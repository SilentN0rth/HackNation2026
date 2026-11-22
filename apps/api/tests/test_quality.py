"""Twarde reguły walidatora i ostrzeżenia jakości (długie etykiety, brak walidatorów, śmieciowe tytuły)."""

import copy

import pytest

from app.coi import builder
from app.coi.jsonata import show_query
from app.coi.quality import quality, summary
from app.coi.validator import errors, validate
from app.coi.walk import leaves
from app.mapping.frontend import from_frontend, to_frontend
from app.understand.model import FieldIR, FormIR, PageIR, SectionIR


@pytest.fixture
def coi() -> dict:
    page = PageIR("Szczegóły", [SectionIR("Sprawa", [FieldIR("a", "Opis sprawy", "TEXTAREA")])])
    return builder.build(FormIR("Wniosek o coś", "Urząd Gminy Testowo", [page]))[0]


def codes(issues) -> set[str]:
    return {i.code for i in issues}


def field(coi: dict, tech: str) -> dict:
    return next(i.field for i in leaves(coi) if i.field["techName"] == tech)


def add_field(coi: dict, tab: int, **overrides) -> dict:
    section = coi["tabs"][tab]["questions"][0]["field"]
    new = copy.deepcopy(section["repeatingSectionGrid"][0])
    new["field"].update(id=f"id-{len(section['repeatingSectionGrid'])}-{tab}", techName=f"extra_{len(section['repeatingSectionGrid'])}_{tab}", **overrides)
    section["repeatingSectionGrid"].append(new)
    return new["field"]


# --- ostrzeżenia jakości -----------------------------------------------------------------------


def test_clean_generated_form_has_no_quality_warnings(coi):
    assert quality(coi) == []


def test_long_label_is_flagged(coi):
    add_field(coi, 1, title="Oświadczam, że " + "bardzo długi akapit papierowej zgody " * 6)
    assert "long-title" in codes(quality(coi))


def test_whitespace_label_is_flagged(coi):
    add_field(coi, 1, title="Wybierz,\nco mamy zrobić")
    assert "title-whitespace" in codes(quality(coi))


@pytest.mark.parametrize("title", ["Tak nie", "Pesel", "Nip"])
def test_junk_page_titles_are_flagged(coi, title):
    coi["tabs"][1]["title"] = title
    assert "junk-title" in codes(quality(coi))


def test_known_short_page_title_is_not_junk(coi):
    coi["tabs"][1]["title"] = "Dane"
    assert "junk-title" not in codes(quality(coi))


def test_heavy_section_and_page_are_flagged(coi):
    for _ in range(26):
        add_field(coi, 1, title="Pole")
    assert {"heavy-section", "heavy-page"} <= codes(quality(coi))


def test_missing_validator_for_pesel_label(coi):
    add_field(coi, 1, title="Numer PESEL", type="TEXT_FIELD", validation=["REQUIRED"], readOnly=False)
    assert "missing-validator" in codes(quality(coi))
    add_field(coi, 1, title="Numer PESEL", type="TEXT_FIELD", validation=["REQUIRED", "PESEL"], readOnly=False)
    assert len([i for i in quality(coi) if i.code == "missing-validator"]) == 1


@pytest.mark.parametrize(("href", "flagged"), [("klauzulą informacyjną", True), ("https://bip.example.org/k", False)])
def test_consent_link_must_be_a_url(coi, href, flagged):
    consent = next(i.field for i in leaves(coi) if i.field["type"] == "CONSENT_SECTION")
    consent["consentSectionConfig"]["consents"][0]["description"] = f'<p><a href="{href}">klauzula</a></p>'
    assert ("consent-link" in codes(quality(coi))) is flagged


def test_summary_counts_by_code(coi):
    add_field(coi, 1, title="a\nb")
    add_field(coi, 1, title="c\nd")
    assert summary(coi)["title-whitespace"] == 2


# --- twarde reguły walidatora ----------------------------------------------------------------------


def test_generated_form_has_no_errors(coi):
    assert errors(coi) == []


def test_text_block_on_finish_is_only_a_warning(coi):
    finish = coi["tabs"][-1]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]
    finish["type"] = "TEXT_BLOCK"
    issues = [i for i in validate(coi) if i.code == "finish-type"]
    assert [i.severity for i in issues] == ["warning"] and errors(coi) == []


def test_input_on_finish_is_an_error(coi):
    coi["tabs"][-1]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]["type"] = "TEXT_FIELD"
    assert "finish-input" in codes(errors(coi))


def test_tab_without_incoming_or_outgoing_link_is_an_error(coi):
    coi["flow"]["links"] = coi["flow"]["links"][:-1]
    assert "flow" in codes(errors(coi))


def test_state_pointing_to_missing_field_is_an_error(coi):
    broken = add_field(coi, 1, title="Zależne")
    broken["states"] = [{"type": "SHOW", "query": show_query("Tak", "Szczegóły", "sprawa", "nie_ma_takiego")}]
    assert "state-ref" in codes(errors(coi))


def test_invalid_state_type_is_an_error(coi):
    bad = add_field(coi, 1, title="Zależne")
    bad["states"] = [{"type": "HIDE", "query": "x"}]
    assert "state" in codes(errors(coi))


def test_empty_section_is_an_error(coi):
    coi["tabs"][1]["questions"][0]["field"]["repeatingSectionGrid"] = []
    assert "empty-section" in codes(errors(coi))


def test_address_dictionary_only_on_select(coi):
    bad = add_field(coi, 1, title="Kraj", dictionaryName="Kraje", options=[])
    assert "dictionary" in codes(errors(coi))
    bad["type"] = "SELECT"
    assert "dictionary" not in codes(errors(coi))


# --- regresja: zmiana nazwy strony w edytorze nie psuje stanów sekcji -----------------------------


def test_renaming_page_keeps_section_states_valid(coi):
    schema = to_frontend(coi, {}, schema_id="s", version=1, issuer="U", source_file="x.pdf")
    schema["pages"][0]["title"] = "Dane wnioskodawcy"
    back, _ = from_frontend(coi, {}, schema)
    assert errors(back) == []
    section = next(q["field"] for q in back["tabs"][0]["questions"] if q["field"]["techName"] == "dane_podmiotu")
    assert "Dane wnioskodawcy" in section["states"][0]["query"] and "'Dane' in title" not in section["states"][0]["query"]


# --- język i organ ----------------------------------------------------------------------------------


def set_consent(coi: dict, html: str) -> None:
    consent = next(i.field for i in leaves(coi) if i.field["type"] == "CONSENT_SECTION")
    consent["consentSectionConfig"]["consents"][0]["description"] = html


@pytest.mark.parametrize("text", ["<p>Zapoznałem się z regulaminem.</p>", "<p>Ja, zapoznałam się z klauzulą.</p>"])
def test_gendered_consent_is_flagged(coi, text):
    set_consent(coi, text)
    assert "language-gender" in codes(quality(coi))


def test_neutral_consent_is_not_flagged(coi):
    set_consent(coi, "<p>Zapoznaję się z regulaminem.</p>")
    assert not {"language-gender", "language-participle"} & codes(quality(coi))


def test_participle_is_flagged(coi):
    set_consent(coi, "<p>Wnioskując o zwrot, potwierdzam dane.</p>")
    assert "language-participle" in codes(quality(coi))


@pytest.mark.parametrize(("name", "flagged"), [("Urząd Miasta i Gminy", True), ("Wójt Gminy", True), ("Urząd Gminy Ulan-Majorat", False)])
def test_organ_name_needs_a_proper_noun(coi, name, flagged):
    organ = next(i.field for i in leaves(coi) if i.field["techName"] in ("nazwa_urzedu", "nazwa_organu"))
    organ["defaultValue"] = name
    assert ("organ-name" in codes(quality(coi))) is flagged


def test_register_fields_must_be_read_only(coi):
    external = [i.field for i in leaves(coi) if i.field.get("defaultValueType") == "EXTERNAL_SYSTEM"]
    assert external and all(f["readOnly"] for f in external)
    external[0]["readOnly"] = False
    assert "external-not-readonly" in codes(quality(coi))


@pytest.mark.parametrize(
    ("value", "flagged"),
    [
        ("PESEL.name", False),
        ("PESEL_ADDRESS.permanentAddressStreet", False),
        ("MLPZ.descriptiveOrganizationName", False),
        ("PESEL.postCode", True),
        ("CEIDG.name", True),
        ("PESEL", True),
        ("PESEL.name.surname", True),
    ],
)
def test_register_source_must_come_from_the_catalog(coi, value, flagged):
    external = next(i.field for i in leaves(coi) if i.field.get("defaultValueType") == "EXTERNAL_SYSTEM")
    external["defaultValue"] = value
    assert ("external-bad-source" in codes(quality(coi))) is flagged


def test_catalog_matches_the_initial_data_document():
    from app.coi import initial_data

    assert {s: len(a) for s, a in initial_data.ATTRIBUTES.items()} == {"PESEL": 16, "PESEL_ADDRESS": 18, "MLPZ": 17}


def test_demo_prefill_covers_every_attribute():
    import json

    from app.api.citizen import PREFILL
    from app.coi import initial_data

    assert set(json.loads(PREFILL.read_text(encoding="utf-8"))) == set(initial_data.all_keys())
