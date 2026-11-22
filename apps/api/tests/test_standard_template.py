"""Szablon standardowych sekcji: zgodność ze standardami organizatora i widoczność sekcji u obywatela."""

import pytest

from app.coi import builder
from app.coi.jsonata import parse_expr, show_query
from app.coi.validator import validate
from app.coi.walk import iter_fields, leaves
from app.config import get_settings
from app.mapping.frontend import _condition, section_visibility, to_frontend
from app.understand.model import FieldIR, FormIR, PageIR, SectionIR


@pytest.fixture
def form() -> FormIR:
    page = PageIR("Szczegóły", [SectionIR("Sprawa", [FieldIR("a", "Opis sprawy", "TEXTAREA")])])
    return FormIR("Wniosek o coś", "Wójt Gminy Testowo", [page])


@pytest.fixture
def built(form) -> dict:
    return builder.build(form)[0]


def fields(coi: dict) -> dict[str, dict]:
    return {item.field["techName"]: item.field for item in leaves(coi)}


def atom(value: str, section: str, name: str) -> str:
    return show_query(value, "Dane", section, name)


# --- jednostkowe: parser jsonaty ---------------------------------------------------------


def test_parse_expr_single_atom():
    kind, ref = parse_expr(atom("Swoim", "podmiot_wniosku", "kto"))
    assert (kind, ref.value, ref.section, ref.field) == ("atom", "Swoim", "podmiot_wniosku", "kto")


def test_parse_expr_or_with_nested_and():
    query = f"{atom('A', 's', 'x')}\nor\n(\n{atom('B', 's', 'x')}\nand\n{atom('C', 's', 'y')}\n)"
    tree = parse_expr(query)
    assert tree[0] == "or" and tree[1][1][0] == "and"


def test_parse_expr_rejects_foreign_syntax():
    assert parse_expr("1 = 1") is None
    assert parse_expr(f"{atom('A', 's', 'x')} and") is None


def test_condition_applies_de_morgan_to_negated_and():
    tree = parse_expr(f"$not({atom('A', 's', 'x')} and {atom('B', 's', 'y')})")
    index = {("Dane", "s", "x"): {"id": "1"}, ("Dane", "s", "y"): {"id": "2"}}
    cond = _condition(tree, index)
    assert cond == {"anyOf": [{"fieldId": "1", "equals": "A", "negate": True}, {"fieldId": "2", "equals": "B", "negate": True}]}


# --- kontraktowe: wymagania ze standardów -------------------------------------------------


@pytest.mark.parametrize(
    ("tech", "expected"),
    [
        ("numer_pesel", {"REQUIRED", "PESEL"}),
        ("numer_pesel_inna_osoba", {"REQUIRED", "PESEL"}),
        ("nip", {"REQUIRED", "NIP"}),
        ("regon", {"REQUIRED", "REGON"}),
        ("kod_pocztowy", {"REQUIRED", "ZIP_CODE"}),
        ("adres_e_mail", {"EMAIL"}),
        ("kraj", {"REQUIRED"}),
        ("plik_dokumentu_z_pelnomocnictwem", {"REQUIRED"}),
    ],
)
def test_standard_fields_have_required_validators(built, tech, expected):
    assert expected <= set(fields(built)[tech]["validation"])


def test_krs_is_optional_and_explains_format(built):
    krs = fields(built)["numer_krs"]
    assert "REQUIRED" not in krs["validation"] and "10 cyfr" in krs["description"]


def test_finish_page_contains_only_info_section(built):
    finish = built["tabs"][-1]
    assert finish["type"] == "FINISH"
    types = {c["field"]["type"] for q in finish["questions"] for c in q["field"]["repeatingSectionGrid"]}
    assert types == {"INFO_SECTION"}


# --- integracyjne: build + walidator + zgoda ------------------------------------------------


def test_built_form_passes_coi_validator_without_errors(built):
    issues = validate(built)
    assert [i for i in issues if i.severity == "error"] == []


def test_tech_names_stay_unique_with_added_fields(built):
    names = [item.field["techName"] for item in iter_fields(built)]
    assert len(names) == len(set(names))


def test_consent_without_clause_url_has_no_dead_link(built):
    consent = next(i.field for i in leaves(built) if i.field["type"] == "CONSENT_SECTION")
    text = consent["consentSectionConfig"]["consents"][0]["description"]
    assert "{{" not in text and "href" not in text and consent["consentSectionConfig"]["consents"][0]["required"] is True


def test_consent_with_clause_url_links_to_it(form, monkeypatch):
    monkeypatch.setenv("CLAUSE_URL", "https://bip.example.org/klauzula")
    get_settings.cache_clear()
    try:
        coi = builder.build(form)[0]
    finally:
        monkeypatch.delenv("CLAUSE_URL")
        get_settings.cache_clear()
    consent = next(i.field for i in leaves(coi) if i.field["type"] == "CONSENT_SECTION")
    text = consent["consentSectionConfig"]["consents"][0]["description"]
    assert 'href="https://bip.example.org/klauzula"' in text and 'rel="noopener noreferrer"' in text


# --- widoczność sekcji u obywatela (symulacja wypełniania) -------------------------------------


def holds(cond, values: dict) -> bool:
    if cond is None:
        return True
    if "allOf" in cond:
        return all(holds(c, values) for c in cond["allOf"])
    if "anyOf" in cond:
        return any(holds(c, values) for c in cond["anyOf"])
    match = values.get(cond["fieldId"]) == cond["equals"]
    return not match if cond.get("negate") else match


@pytest.fixture
def citizen(form):
    coi, meta = builder.build(form)
    schema = to_frontend(coi, meta, schema_id="s", version=1, issuer="U", source_file="x.pdf")
    by_tech = {i.field["techName"]: i.field["id"] for i in leaves(coi)}
    return coi, schema, by_tech


def test_radio_option_values_equal_labels_used_in_conditions(citizen):
    _, schema, by_tech = citizen
    for tech in ("wybierz_w_czyim_imieniu_wnioskujesz", "wybierz_jako_kto_wnioskujesz"):
        field = next(f for p in schema["pages"] for f in p["fields"] if f["id"] == by_tech[tech])
        assert all(o["value"] == o["label"] for o in field["options"])


@pytest.mark.parametrize(
    ("who", "as_whom", "shown", "hidden"),
    [
        ("Swoim", None, [], ["nip", "numer_pesel_inna_osoba", "plik_dokumentu_z_pelnomocnictwem"]),
        ("Innej osoby", None, ["numer_pesel_inna_osoba", "plik_dokumentu_z_pelnomocnictwem"], ["nip"]),
        ("Osoby prawnej lub jednostki organizacyjnej", "Pełnomocnik", ["nip", "plik_dokumentu_z_pelnomocnictwem", "plik_z_potwierdzeniem_przelewu_2"], ["numer_pesel_inna_osoba", "plik_z_odpisem_danych"]),
        ("Osoby prawnej lub jednostki organizacyjnej", "Reprezentant", ["nip", "plik_z_odpisem_danych"], ["plik_dokumentu_z_pelnomocnictwem", "plik_z_potwierdzeniem_przelewu_2"]),
    ],
)
def test_subject_choice_shows_only_matching_sections(citizen, who, as_whom, shown, hidden):
    coi, _, by_tech = citizen
    visibility = section_visibility(coi)
    values = {by_tech["wybierz_w_czyim_imieniu_wnioskujesz"]: who}
    if as_whom:
        values[by_tech["wybierz_jako_kto_wnioskujesz"]] = as_whom
    assert all(holds(visibility.get(by_tech[t]), values) for t in shown)
    assert not any(holds(visibility.get(by_tech[t]), values) for t in hidden)


def test_every_section_state_is_mapped_for_citizen(citizen):
    coi, _, _ = citizen
    mapped = section_visibility(coi)
    sections = [i.field for i in iter_fields(coi) if i.section is None and i.field.get("states")]
    expected = {c["field"]["id"] for s in sections for c in s["repeatingSectionGrid"]}
    assert expected <= set(mapped)


def test_every_option_has_id_name_and_tech_name(built):
    for item in leaves(built):
        for option in item.field.get("options") or []:
            assert option["id"] and option["name"] and option["techName"], item.field["techName"]


def test_citizen_gets_upload_fields_as_file_type(citizen):
    _, schema, by_tech = citizen
    fields = {f["id"]: f for p in schema["pages"] for f in p["fields"]}
    upload = fields[by_tech["plik_dokumentu_z_pelnomocnictwem"]]
    assert upload["type"] == "file" and upload["required"] is True


def test_editor_roundtrip_keeps_upload_type(citizen):
    from app.mapping.frontend import from_frontend

    coi, _, by_tech = citizen
    schema = to_frontend(coi, {}, schema_id="s", version=1, issuer="U", source_file="x.pdf")
    back, _ = from_frontend(coi, {}, schema)
    kinds = {i.field["techName"]: i.field["type"] for i in leaves(back)}
    assert kinds["plik_dokumentu_z_pelnomocnictwem"] == "FILE_UPLOADER"


@pytest.mark.parametrize(
    ("target", "checkbox"),
    [("ulica", "brak_nazwy_ulicy_zamieszkania"), ("numer_lokalu", "brak_numeru_lokalu_zamieszkania"), ("ulica_siedziba", "brak_nazwy_ulicy_siedziby")],
)
def test_address_has_lock_checkboxes(built, target, checkbox):
    by_tech = fields(built)
    assert by_tech[checkbox]["type"] == "CHECKBOX"
    states = [s for s in by_tech[target]["states"] if s["type"] == "READ_ONLY"]
    assert len(states) == 1 and checkbox in states[0]["query"]


def test_citizen_locks_street_when_box_is_checked(citizen):
    _, schema, by_tech = citizen
    street = next(f for p in schema["pages"] for f in p["fields"] if f["id"] == by_tech["ulica"])
    assert street["readOnlyIf"] == {"fieldId": by_tech["brak_nazwy_ulicy_zamieszkania"], "equals": True}


def test_address_dictionary_is_the_same_for_every_address(built):
    names = {f["dictionaryName"] for f in fields(built).values() if f.get("dictionaryName", "").startswith("TERYT")}
    assert names == {"TERYT_4G_DOWODOWY"}
