"""Walidator reguł COI: oba wzorce przechodzą, zepsute warianty – nie."""

import copy
import json

import pytest

from app.coi.jsonata import parse_query, show_query
from app.coi.validator import validate_coi
from tests.conftest import REFERENCE

WZORCE = sorted(REFERENCE.glob("wzorzec_*.json"))


def errors(data) -> list[str]:
    return [i.rule for i in validate_coi(data) if i.severity == "error"]


@pytest.fixture(params=WZORCE, ids=lambda p: p.stem)
def wzorzec(request) -> dict:
    return json.loads(request.param.read_text())


def test_validate_reference_form_has_no_errors_or_warnings(wzorzec):
    issues = validate_coi(wzorzec)

    assert [i for i in issues if i.severity != "info"] == []


def test_validate_without_finish_page_reports_last_not_finish(wzorzec):
    broken = copy.deepcopy(wzorzec)
    broken["tabs"] = broken["tabs"][:-1]

    assert "last-not-finish" in errors(broken)


def test_validate_field_outside_section_reports_error(wzorzec):
    broken = copy.deepcopy(wzorzec)
    first_section = broken["tabs"][0]["questions"][0]
    broken["tabs"][0]["questions"].append(first_section["field"]["repeatingSectionGrid"][0])

    assert "field-outside-section" in errors(broken)


def test_validate_nested_section_reports_error(wzorzec):
    broken = copy.deepcopy(wzorzec)
    outer = broken["tabs"][0]["questions"][0]["field"]
    inner = copy.deepcopy(broken["tabs"][0]["questions"][1])
    inner["field"]["techName"] = "zagniezdzona"
    outer["repeatingSectionGrid"].append(inner)

    assert "nested-section" in errors(broken)


def test_validate_input_on_finish_page_reports_error(wzorzec):
    broken = copy.deepcopy(wzorzec)
    grid = broken["tabs"][-1]["questions"][0]["field"]["repeatingSectionGrid"]
    grid[0]["field"]["type"] = "TEXT_FIELD"

    assert "finish-input" in errors(broken)


def test_validate_dictionary_on_text_field_reports_error(wzorzec):
    broken = copy.deepcopy(wzorzec)
    field = broken["tabs"][0]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]
    field["dictionaryName"] = "Kraje"

    assert "dictionary-type" in errors(broken)


def test_validate_duplicate_techname_reports_error(wzorzec):
    broken = copy.deepcopy(wzorzec)
    grid = broken["tabs"][0]["questions"][2]["field"]["repeatingSectionGrid"]
    grid[1]["field"]["techName"] = grid[0]["field"]["techName"]

    assert "techname-duplicate" in errors(broken)


def test_validate_missing_title_key_reports_schema_error():
    assert errors({"tabs": []}) == ["schema"]


def test_show_query_roundtrips_through_parser():
    q = show_query("Tak", "Dane", "oplata", "czy_wymaga", negate=True)

    (ref,) = parse_query(q)

    assert (ref.value, ref.tab_title, ref.section_tech, ref.field_tech, ref.negated) == (
        "Tak", "Dane", "oplata", "czy_wymaga", True)


def test_parse_query_reads_all_reference_conditions(wzorzec):
    queries = [
        s["query"]
        for t in wzorzec["tabs"] for q in t["questions"]
        for f in [q["field"], *[c["field"] for c in q["field"]["repeatingSectionGrid"]]]
        for s in f.get("states") or []
    ]

    assert queries, "wzorzec powinien mieć warunki"
    assert all(parse_query(q) for q in queries)
