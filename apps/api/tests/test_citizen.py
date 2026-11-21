"""Testy API obywatela: opublikowane e-usługi, dane inicjalne i wnioski."""

import json

import pytest

from tests.conftest import FIXTURES


@pytest.fixture
def form_id(store) -> str:
    coi = json.loads((FIXTURES / "wzorzec_nadplata.json").read_text(encoding="utf-8"))
    draft_id = store.create_draft(
        title="Zwrot nadpłaty",
        source_file="nadplata.pdf",
        sha256="0" * 64,
        issuer="Urząd Gminy",
        user_id="u-urzednik",
        coi=coi,
        meta={},
        flags=[],
        extras={},
    )
    return store.publish(store.draft(draft_id), "Anna Nowak")["id"]


def new_application(client, citizen, form_id, **body):
    return client.post("/applications", headers=citizen, json={"formId": form_id, "status": "draft", **body})


def test_forms_require_token(client, form_id):
    assert client.get("/forms").status_code == 401


def test_forms_list_and_detail(client, citizen, official, form_id):
    forms = client.get("/forms", headers=citizen).json()
    assert [f["id"] for f in forms] == [form_id]
    assert forms[0]["publishedBy"] == "Anna Nowak"
    assert client.get("/forms", headers=official).status_code == 200

    detail = client.get(f"/forms/{form_id}", headers=citizen).json()
    assert detail["id"] == form_id
    assert detail["schema"]["pages"]


def test_unknown_form(client, citizen):
    assert client.get("/forms/form-brak", headers=citizen).status_code == 404


def test_prefill(client, citizen, official, form_id):
    response = client.get("/prefill", headers=citizen, params={"formId": form_id})
    assert response.status_code == 200
    assert response.json() and all(isinstance(v, str) for v in response.json().values())
    assert client.get("/prefill", headers=citizen, params={"formId": "form-brak"}).status_code == 404
    assert client.get("/prefill", headers=citizen).status_code == 422
    assert client.get("/prefill", headers=official, params={"formId": form_id}).status_code == 403


def test_application_lifecycle(client, citizen, form_id):
    created = new_application(client, citizen, form_id, values={"imie": "Jan"})
    assert created.status_code == 201
    app = created.json()
    assert "userId" not in app
    assert app["formTitle"] == "Zwrot nadpłaty"
    assert app["values"] == {"imie": "Jan"}

    listed = client.get("/applications", headers=citizen).json()
    assert [a["id"] for a in listed] == [app["id"]]

    body = {"formId": form_id, "status": "draft", "values": {"imie": "Jan", "zgoda": True}}
    updated = client.put(f"/applications/{app['id']}", headers=citizen, json=body).json()
    assert updated["values"]["zgoda"] is True

    sent = client.put(f"/applications/{app['id']}", headers=citizen, json={**body, "status": "sent"}).json()
    assert sent["status"] == "sent"
    assert sent["confirmationNo"].startswith("UPO-")
    assert client.get(f"/applications/{app['id']}", headers=citizen).json()["status"] == "sent"

    locked = client.put(f"/applications/{app['id']}", headers=citizen, json=body)
    assert locked.status_code == 409


def test_application_validation(client, citizen, official, form_id):
    assert new_application(client, citizen, "form-brak").status_code == 404
    assert client.post("/applications", headers=citizen, json={"formId": form_id, "status": "zly"}).status_code == 422
    assert new_application(client, official, form_id).status_code == 403
    assert client.get("/applications", headers=official).status_code == 403
    body = {"formId": form_id, "status": "draft"}
    assert client.put("/applications/app-brak", headers=citizen, json=body).status_code == 404


def test_foreign_application_is_hidden(client, citizen, form_id, store):
    foreign = store.save_application(
        app_id=None, form_id=form_id, form_title="Zwrot nadpłaty", status="draft", user_id="u-inny", answers={}
    )
    assert client.get("/applications", headers=citizen).json() == []
    assert client.get(f"/applications/{foreign['id']}", headers=citizen).status_code == 404
    body = {"formId": form_id, "status": "draft"}
    assert client.put(f"/applications/{foreign['id']}", headers=citizen, json=body).status_code == 404
