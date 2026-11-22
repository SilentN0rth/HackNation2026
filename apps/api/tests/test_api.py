from tests.conftest import sample


def upload(client, headers, form="2", extension=".pdf"):
    name, data = sample(form, extension)
    return client.post("/drafts", headers=headers, files={"file": (name, data)})


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["llm"] == "disabled"


def test_auth_required(client):
    response = client.get("/drafts")
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


def test_role_is_enforced(client, citizen):
    assert client.get("/drafts", headers=citizen).status_code == 403


def test_convert_returns_coi(client, official):
    name, data = sample("2", ".pdf")
    response = client.post("/api/v1/convert", headers=official, files={"file": (name, data)})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"title", "tabs", "flow"}
    assert body["tabs"][-1]["type"] == "FINISH"


def test_convert_with_meta_and_flags(client, official):
    name, data = sample("5", ".pdf")
    response = client.post("/api/v1/convert?include=meta,flags", headers=official, files={"file": (name, data)})
    body = response.json()
    assert {"form", "meta", "flags"} <= set(body)
    assert body["meta"]["issuer"] == "Urząd Gminy Ulan-Majorat"


def test_convert_rejects_bad_name(client, official):
    response = client.post("/api/v1/convert", headers=official, files={"file": ("wniosek;1.pdf", b"%PDF-1.7")})
    assert response.status_code == 422
    assert "niedozwolone" in response.json()["detail"]


def test_convert_rejects_mismatched_content(client, official):
    response = client.post("/api/v1/convert", headers=official, files={"file": ("wniosek.pdf", b"\x89PNG\r\n\x1a\n0000")})
    assert response.status_code == 415


def test_convert_rejects_large_file(client, official, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_upload_mb", 0.001)
    response = client.post("/api/v1/convert", headers=official, files={"file": ("wniosek.pdf", b"%PDF-1.7" + b"0" * 4096)})
    assert response.status_code == 413


def test_convert_rejects_oversized_request_before_reading_body(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_upload_mb", 0.001)
    response = client.post("/api/v1/convert", files={"file": ("wniosek.pdf", b"%PDF-1.7" + b"0" * 200_000)})
    assert response.status_code == 413
    assert response.headers["content-type"] == "application/problem+json"


def test_batch(client, official):
    files = [("files", sample(n, ".pdf")) for n in ("1", "2")] + [("files", ("zly.txt", b"abc"))]
    response = client.post("/api/v1/convert/batch", headers=official, files=files)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"


def test_full_draft_flow(client, official, citizen, store):
    draft_id = upload(client, official).json()["draftId"]
    drafts = client.get("/drafts", headers=official).json()
    assert drafts[0]["id"] == draft_id

    draft = client.get(f"/drafts/{draft_id}", headers=official).json()
    schema = draft["schema"]
    page = next(p for p in schema["pages"] if p["title"] != "Dane")
    page["fields"][0]["label"] = "Data zapłaty"
    saved = client.put(f"/drafts/{draft_id}", headers=official, json={"schema": schema}).json()
    labels = [f["label"] for p in saved["schema"]["pages"] for f in p["fields"]]
    assert "Data zapłaty" in labels

    coi = client.get(f"/drafts/{draft_id}/coi", headers=official).json()
    assert any(q for t in coi["tabs"] for q in t["questions"])

    flags = client.post(f"/drafts/{draft_id}/lint", headers=official).json()
    if flags:
        bad = client.patch(f"/drafts/{draft_id}/flags/{flags[0]['id']}", headers=official, json={"action": "rejected", "justification": "krótko"})
        assert bad.status_code == 422
        ok = client.patch(
            f"/drafts/{draft_id}/flags/{flags[0]['id']}",
            headers=official,
            json={"action": "rejected", "justification": "Pole wymagane przez regulamin gminy."},
        )
        assert ok.json()["resolution"]["action"] == "rejected"

    published = client.post(f"/drafts/{draft_id}/publish", headers=official)
    assert published.status_code == 200, published.text
    form_id = published.json()["id"]

    assert client.put(f"/drafts/{draft_id}", headers=official, json={"schema": schema}).status_code == 409
    assert client.get("/forms", headers=citizen).json()[0]["id"] == form_id
    prefill = client.get(f"/prefill?formId={form_id}", headers=citizen).json()
    assert prefill["PESEL.pesel"]

    created = client.post("/applications", headers=citizen, json={"formId": form_id, "status": "draft", "values": {"a": "b"}}).json()
    sent = client.put(
        f"/applications/{created['id']}",
        headers=citizen,
        json={"formId": form_id, "status": "sent", "values": {"a": "b"}},
    ).json()
    assert sent["confirmationNo"].startswith("UPO-")
    assert client.get("/applications?mine=true", headers=citizen).json()[0]["status"] == "sent"

    actions = [e["action"] for e in client.get(f"/audit?draftId={draft_id}", headers=official).json()]
    assert {"upload", "draft_generated", "field_edited", "published"} <= set(actions)
    assert client.get("/audit/verify", headers=official).json()["intact"] is True


def test_publish_blocked_by_open_errors(client, official, store):
    draft_id = upload(client, official).json()["draftId"]
    draft = store.draft(draft_id)
    flags = [{"id": "static-graph:test:x", "linter": "static-graph", "severity": "error", "title": "Błąd", "message": "Test"}]
    store.update_draft(draft_id, flags=flags)
    response = client.post(f"/drafts/{draft_id}/publish", headers=official)
    assert response.status_code == 409
    assert draft["status"] == "review"


def test_audit_tampering_is_detected(client, official, store):
    upload(client, official)
    store.conn.execute("UPDATE audit SET details = 'zmienione' WHERE seq = 1")
    assert client.get("/audit/verify", headers=official).json()["intact"] is False


def test_dictionaries(client):
    names = {d["name"] for d in client.get("/dictionaries").json()}
    assert {"Kraje", "Województwo", "RASY_PSOW_UZNAWANYCH_ZA_AGRESYWNE"} <= names
    breeds = client.get("/dictionaries/RASY_PSOW_UZNAWANYCH_ZA_AGRESYWNE").json()
    assert breeds["proposal"] is True and len(breeds["values"]) == 11


def test_predefined_dictionaries_are_filled(client):
    size = lambda name: len(client.get(f"/dictionaries/{name}").json()["values"])  # noqa: E731
    assert size("Województwo") == 16
    assert size("Powiat") == 380
    assert size("Gmina") == 2479
    assert size("Kraje") >= 190
    assert size("Numery kierunkowe") >= 200
    assert client.get("/dictionaries/Kraje").json()["values"][0]["name"] == "Polska"
    assert client.get("/dictionaries/Numery kierunkowe").json()["values"][0]["name"] == "+48"


def test_convert_accepts_api_key(client, monkeypatch):
    from pydantic import SecretStr

    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "api_key", SecretStr("klucz-testowy"))
    name, data = sample("2", ".pdf")
    ok = client.post("/api/v1/convert", headers={"X-API-Key": "klucz-testowy"}, files={"file": (name, data)})
    bad = client.post("/api/v1/convert", headers={"X-API-Key": "zly"}, files={"file": (name, data)})
    assert ok.status_code == 200 and "tabs" in ok.json()
    assert bad.status_code == 401


def test_api_key_disabled_when_not_configured(client):
    name, data = sample("2", ".pdf")
    response = client.post("/api/v1/convert", headers={"X-API-Key": "cokolwiek"}, files={"file": (name, data)})
    assert response.status_code == 401


def test_token_requires_client_secret_when_configured(client, monkeypatch):
    from pydantic import SecretStr

    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "token_client_secret", SecretStr("sekret-frontu"))
    assert client.post("/auth/token", json={"userId": "u-urzednik"}).status_code == 401
    ok = client.post("/auth/token", json={"userId": "u-urzednik"}, headers={"X-Client-Secret": "sekret-frontu"})
    assert ok.status_code == 200
