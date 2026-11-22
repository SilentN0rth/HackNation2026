import json

import pytest

from app.coi.validator import errors
from app.coi.walk import leaves
from app.mapping.frontend import from_frontend, to_frontend
from tests.conftest import FIXTURES


@pytest.fixture(params=sorted(FIXTURES.glob("wzorzec_*.json")), ids=lambda p: p.stem)
def template(request) -> dict:
    return json.loads(request.param.read_text(encoding="utf-8"))


def frontend(coi: dict) -> dict:
    return to_frontend(coi, {}, schema_id="t", version=1, issuer="Urząd", source_file="wniosek.pdf")


def test_round_trip_is_lossless(template):
    back, _ = from_frontend(template, {}, frontend(template))
    assert json.dumps(back, sort_keys=True) == json.dumps(template, sort_keys=True)


def test_rename_page_updates_conditions(template):
    schema = frontend(template)
    page = next(p for p in schema["pages"] if any("visibleIf" in f for f in p["fields"]))
    page["title"] = "Nowa nazwa strony"
    back, _ = from_frontend(template, {}, schema)
    assert errors(back) == []
    queries = [s["query"] for item in leaves(back) for s in item.field.get("states") or []]
    assert any("Nowa nazwa strony" in q for q in queries)


def test_edit_and_delete_field(template):
    schema = frontend(template)
    page = schema["pages"][1]
    page["fields"][0]["label"] = "Zmieniona etykieta"
    page["fields"][0]["required"] = True
    removed = page["fields"].pop()
    back, _ = from_frontend(template, {}, schema)
    titles = {item.field["id"]: item.field for item in leaves(back)}
    assert titles[page["fields"][0]["id"]]["title"] == "Zmieniona etykieta"
    assert "REQUIRED" in titles[page["fields"][0]["id"]]["validation"]
    assert removed["id"] not in titles
    assert errors(back) == []


def test_fields_carry_their_section_title(template):
    schema = frontend(template)
    fields = [f for p in schema["pages"] for f in p["fields"]]
    assert fields and all(f.get("section") for f in fields)


def test_fields_follow_grid_position_not_array_order():
    template = json.loads((FIXTURES / "wzorzec_numer_porzadkowy.json").read_text(encoding="utf-8"))
    labels = [f["label"] for p in frontend(template)["pages"] for f in p["fields"]]
    assert labels.index("Wybierz, w czyim imieniu wnioskujesz") < labels.index("Wybierz, jako kto wnioskujesz")
