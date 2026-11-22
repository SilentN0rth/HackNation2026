"""Zgodność plików wynikowych ze schematem importu od organizatora (importowanyPlikJsonSchemat.json).

Schemat jest luźny i ma literówki (repetingSectionGrid, defaultValue jako string), więc wzorce organizatora też
nie przechodzą go dosłownie. Dlatego sprawdzamy typy pól opisanych w schemacie, z tymi samymi tolerancjami,
które mają wzorce organizatora.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from tests.conftest import FIXTURES

SCHEMA = json.loads((FIXTURES / "importowanyPlikJsonSchemat.json").read_text(encoding="utf-8"))
OUTPUTS = sorted((Path(__file__).resolve().parents[3] / "outputs").glob("0*.json"))
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "number": (int, float)}
TOLERATED = {("validation", dict), ("defaultValue", list), ("defaultValue", type(None)), ("description", type(None))}


def check(node: dict, value, path: str, problems: list[str]) -> None:
    expected = node.get("type")
    if expected and not isinstance(value, TYPES[expected]):
        if (path.rsplit(".", 1)[-1].rstrip("[]"), type(value)) not in TOLERATED:
            problems.append(f"{path}: oczekiwano {expected}, jest {type(value).__name__}")
        return
    if isinstance(value, dict):
        for key, sub in (node.get("properties") or {}).items():
            if key in value:
                check(sub, value[key], f"{path}.{key}", problems)
    if isinstance(value, list) and "items" in node:
        for index, item in enumerate(value):
            check(node["items"], item, f"{path}[{index}]", problems)


def problems_of(document: dict) -> list[str]:
    problems: list[str] = []
    check(SCHEMA, document, "$", problems)
    # pola zagnieżdżone w sekcjach mają taką samą strukturę jak pytania (schemat opisuje je tylko jako tablicę)
    for tab in document["tabs"] if isinstance(document.get("tabs"), list) else []:
        for question in tab["questions"] if isinstance(tab.get("questions"), list) else []:
            for child in question["field"].get("repeatingSectionGrid") or []:
                check(SCHEMA["properties"]["tabs"]["items"]["properties"]["questions"]["items"], child, f"$.{tab['title']}.child", problems)
    return problems


@pytest.mark.parametrize("fixture", ["wzorzec_numer_porzadkowy.json", "wzorzec_nadplata.json"])
def test_organizer_references_pass_with_the_same_tolerances(fixture):
    document = json.loads((FIXTURES / fixture).read_text(encoding="utf-8"))
    assert problems_of(document) == []


@pytest.mark.parametrize("path", OUTPUTS, ids=lambda p: p.name[:2])
def test_outputs_match_import_schema(path):
    assert problems_of(json.loads(path.read_text(encoding="utf-8"))) == []


def test_validator_detects_wrong_types():
    broken = {"title": 5, "tabs": [{"id": "a", "title": "t", "type": "MAIN", "questions": "nie lista"}], "flow": {"links": []}}
    assert len(problems_of(broken)) == 2


def strict_errors(document: dict) -> list[str]:
    validator = Draft202012Validator(SCHEMA)
    return [f"$.{'.'.join(str(p) for p in e.absolute_path)}: {e.message}" for e in validator.iter_errors(document)]


@pytest.mark.parametrize("fixture", ["wzorzec_numer_porzadkowy.json", "wzorzec_nadplata.json"])
def test_organizer_references_pass_strict_json_schema(fixture):
    assert strict_errors(json.loads((FIXTURES / fixture).read_text(encoding="utf-8"))) == []


@pytest.mark.parametrize("path", OUTPUTS, ids=lambda p: p.name[:2])
def test_outputs_pass_strict_json_schema(path):
    assert strict_errors(json.loads(path.read_text(encoding="utf-8"))) == []


def test_strict_validation_detects_wrong_types():
    assert strict_errors({"title": 5, "tabs": [{"id": "a", "questions": "nie lista"}]})
