"""Round-trip: wzorzec COI → model frontendu → COI daje ten sam wynik; edycje trafiają we właściwe miejsca."""

import copy
import json

import pytest

from app.coi.jsonata import parse_query
from app.coi.validator import validate_coi
from app.mapping.frontend import apply_front_schema, coi_to_front
from tests.conftest import REFERENCE


@pytest.fixture(params=sorted(REFERENCE.glob("wzorzec_*.json")), ids=lambda p: p.stem)
def coi(request) -> dict:
    return json.loads(request.param.read_text())


def front_field(schema: dict, tech: str) -> dict:
    return next(f for p in schema["pages"] for f in p["fields"] if f["id"] == tech)


def test_roundtrip_without_edits_returns_identical_coi(coi):
    schema = coi_to_front(coi, {}, "x", 1, "plik.pdf")

    back, _ = apply_front_schema(coi, {}, schema)

    assert back == coi


def test_coi_to_front_maps_prefill_dictionary_and_condition(coi):
    schema = coi_to_front(coi, {}, "x", 1, "plik.pdf")

    imie = front_field(schema, "imie")
    woj = front_field(schema, "wojewodztwo")
    assert imie["prefill"]["source"] in {"MLPZ", "PESEL"}
    assert imie["prefill"]["key"].endswith(".name")
    assert woj["dictionaryId"].startswith("TERYT")
    assert woj["visibleIf"] == {"fieldId": "kraj", "equals": "Polska"}
    assert all(p["title"] != "Strona końcowa" for p in schema["pages"])


def test_apply_front_schema_edits_label_required_and_condition(coi):
    schema = coi_to_front(coi, {}, "x", 1, "plik.pdf")
    edited = copy.deepcopy(schema)
    f = front_field(edited, "nazwisko")
    f["label"] = "Twoje nazwisko"
    f["required"] = True
    f["visibleIf"] = {"fieldId": "kraj", "equals": "Polska"}

    back, _ = apply_front_schema(coi, {}, edited)

    out = coi_to_front(back, {}, "x", 1, "plik.pdf")
    g = front_field(out, "nazwisko")
    assert (g["label"], g["required"]) == ("Twoje nazwisko", True)
    (state,) = [s for t in back["tabs"] for q in t["questions"] for c in q["field"]["repeatingSectionGrid"]
                if c["field"]["techName"] == "nazwisko" for s in c["field"]["states"]]
    (ref,) = parse_query(state["query"])
    assert (ref.tab_title, ref.section_tech, ref.field_tech) == ("Dane", "adres_zamieszkania", "kraj")
    assert [i for i in validate_coi(back) if i.severity == "error"] == []


def test_apply_front_schema_removed_field_disappears_from_coi(coi):
    schema = coi_to_front(coi, {}, "x", 1, "plik.pdf")
    for p in schema["pages"]:
        p["fields"] = [f for f in p["fields"] if f["id"] != "regon"]

    back, _ = apply_front_schema(coi, {}, schema)

    techs = {c["field"]["techName"] for t in back["tabs"] for q in t["questions"]
             for c in q["field"]["repeatingSectionGrid"]}
    assert "regon" not in techs
    assert "nip" in techs


def test_apply_front_schema_type_change_to_pesel_sets_validator(coi):
    schema = coi_to_front(coi, {}, "x", 1, "plik.pdf")
    front_field(schema, "nazwisko_inna_osoba")["type"] = "pesel"

    back, _ = apply_front_schema(coi, {}, schema)

    f = front_field(coi_to_front(back, {}, "x", 1, ""), "nazwisko_inna_osoba")
    assert f["type"] == "pesel"
