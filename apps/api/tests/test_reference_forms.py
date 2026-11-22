"""Porównanie wyniku konwersji z wzorcami organizatora (formularze 1 i 5): standardowe sekcje muszą się zgadzać."""

import json
import re

import pytest

from app.coi.validator import errors
from app.coi.walk import children
from app.pipeline import convert
from app.uploads import check_content
from tests.conftest import FIXTURES, sample

CASES = [("1", "wzorzec_numer_porzadkowy.json"), ("5", "wzorzec_nadplata.json")]
RENAMED_SECTIONS = {"urzad_do_ktorego_jest_skladany_wniosek": "organ_do_ktorego_jest_skladany_wniosek"}


def flat(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def sections(coi: dict, tab: str = "Dane") -> dict[str, dict]:
    page = next(t for t in coi["tabs"] if t["title"] == tab)
    return {q["field"]["techName"]: q["field"] for q in page["questions"]}


@pytest.fixture(params=CASES, ids=lambda c: c[0])
def pair(request):
    number, fixture = request.param
    name, data = sample(number, ".pdf")
    ours = convert(check_content(name, data)).coi
    reference = json.loads((FIXTURES / fixture).read_text(encoding="utf-8"))
    return ours, reference


def test_converted_form_has_no_errors(pair):
    assert errors(pair[0]) == []


def test_same_number_of_standard_tabs(pair):
    ours, reference = pair
    assert [t["type"] for t in ours["tabs"]][0] == [t["type"] for t in reference["tabs"]][0] == "MAIN"
    assert ours["tabs"][-1]["type"] == reference["tabs"][-1]["type"] == "FINISH"


def test_every_reference_section_is_present(pair):
    ours, reference = pair
    ours_sections = sections(ours)
    for tech in sections(reference):
        assert RENAMED_SECTIONS.get(tech, tech) in ours_sections or tech in ours_sections, tech


def titled(coi: dict) -> dict[tuple[str, str], str]:
    """(sekcja, tytuł pola) -> typ, z pominięciem plików, których nazwy w starszych wzorcach różnią się od standardów."""
    result = {}
    for tech, section in sections(coi).items():
        tech = {v: k for k, v in RENAMED_SECTIONS.items()}.get(tech, tech)
        for child in children(section):
            field = child["field"]
            if field["type"] != "FILE_UPLOADER":
                title = "Nazwa urzędu" if field["techName"] in ("nazwa_urzedu", "nazwa_organu") else flat(field.get("title") or "")
                if title.startswith("TERYT"):  # wzorce różnią się słownikiem adresowym (3 lub 4 poziomy)
                    title = "TERYT"
                result[(tech, title)] = field["type"]
    return result


def uploads(coi: dict) -> dict[str, int]:
    return {
        tech: sum(1 for c in children(s) if c["field"]["type"] == "FILE_UPLOADER")
        for tech, s in sections(coi).items()
        if any(c["field"]["type"] == "FILE_UPLOADER" for c in children(s))
    }


def test_every_reference_field_is_present_with_the_same_type(pair):
    ours, reference = pair
    mine = titled(ours)
    for key, kind in titled(reference).items():
        assert key in mine, key
        assert mine[key] == kind, key


def test_upload_fields_appear_in_the_same_sections(pair):
    ours, reference = pair
    assert uploads(ours) == uploads(reference)


def test_only_intended_fields_were_added(pair):
    ours, reference = pair
    extra = {key for key in titled(ours) if key not in titled(reference)}
    allowed = {("twoje_dane", "Numer PESEL"), ("dane_innej_osoby", "Numer PESEL"), ("dane_podmiotu", "REGON"), ("dane_podmiotu", "Numer KRS")}
    assert extra <= allowed, extra - allowed


def test_visibility_queries_match_reference(pair):
    ours, reference = pair
    ours_sections = sections(ours)
    for tech, ref_section in sections(reference).items():
        mine = ours_sections.get(RENAMED_SECTIONS.get(tech, tech)) or ours_sections[tech]
        assert [flat(s["query"]) for s in mine.get("states", [])] == [flat(s["query"]) for s in ref_section.get("states", [])], tech


def test_reference_subject_options_are_identical(pair):
    ours, reference = pair
    def options(coi):
        return {
            c["field"]["techName"]: [o["name"] for o in c["field"]["options"]]
            for c in children(sections(coi)["podmiot_wniosku"])
        }
    assert options(ours) == options(reference)
