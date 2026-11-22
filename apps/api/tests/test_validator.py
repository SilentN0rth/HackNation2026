import copy
import json

import pytest

from app.coi.validator import errors, validate
from tests.conftest import FIXTURES

TEMPLATES = sorted(FIXTURES.glob("wzorzec_*.json"))


@pytest.fixture(params=TEMPLATES, ids=lambda p: p.stem)
def template(request) -> dict:
    return json.loads(request.param.read_text(encoding="utf-8"))


def codes(coi: dict) -> set[str]:
    return {issue.code for issue in errors(coi)}


def test_reference_files_are_valid(template):
    assert errors(template) == []


def test_last_page_must_be_finish(template):
    broken = copy.deepcopy(template)
    broken["tabs"][-1]["type"] = "MAIN"
    assert "finish" in codes(broken)


def test_field_outside_section(template):
    broken = copy.deepcopy(template)
    section = broken["tabs"][1]["questions"][0]
    broken["tabs"][1]["questions"].append({**section["field"]["repeatingSectionGrid"][0]})
    assert "outside-section" in codes(broken)


def test_nested_section(template):
    broken = copy.deepcopy(template)
    grid = broken["tabs"][1]["questions"][0]["field"]["repeatingSectionGrid"]
    grid[0]["field"]["type"] = "SECTION"
    assert "nested-section" in codes(broken)


def test_dictionary_requires_empty_options(template):
    broken = copy.deepcopy(template)
    field = broken["tabs"][1]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]
    field["type"] = "SELECT"
    field["dictionaryName"] = "Kraje"
    field["options"] = [{"id": "Polska", "name": "Polska", "techName": "polska"}]
    assert "dictionary" in codes(broken)


def test_input_on_finish_page(template):
    broken = copy.deepcopy(template)
    broken["tabs"][-1]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]["type"] = "TEXT_FIELD"
    assert "finish-input" in codes(broken)


def test_duplicate_tech_name(template):
    broken = copy.deepcopy(template)
    grid = broken["tabs"][1]["questions"][0]["field"]["repeatingSectionGrid"]
    grid.append(copy.deepcopy(grid[0]))
    grid[-1]["field"]["id"] = "inny-id"
    assert "tech-name" in codes(broken)


def _first_leaf(coi: dict, ftype: str) -> dict:
    for tab in coi["tabs"]:
        for question in tab["questions"]:
            for cell in question["field"].get("repeatingSectionGrid") or []:
                if cell["field"]["type"] == ftype:
                    return cell["field"]
    pytest.skip(f"wzorzec nie ma pola {ftype}")


def test_input_without_required_attribute(template):
    broken = copy.deepcopy(template)
    del _first_leaf(broken, "TEXT_FIELD")["validation"]
    assert "required-attr" in {i.code for i in validate(broken)}  # wzorzec organizatora też pomija ten klucz, więc to ostrzeżenie


def test_info_section_needs_description(template):
    broken = copy.deepcopy(template)
    _first_leaf(broken, "INFO_SECTION")["description"] = ""
    assert "info-section" in codes(broken)


def test_consent_needs_required_flag(template):
    broken = copy.deepcopy(template)
    _first_leaf(broken, "CONSENT_SECTION")["consentSectionConfig"] = {"consents": [{"description": "Zgoda"}]}
    assert "consent" in codes(broken)
