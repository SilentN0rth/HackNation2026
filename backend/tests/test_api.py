"""API end-to-end (TestClient): convert, wersje robocze, flagi, publikacja, audit, obywatel, auth, SSE."""

import time
from pathlib import Path

import pytest

from tests.conftest import sample_files

PDF_NAME = "Wniosek o zwrot opłaty skarbowej.pdf"


@pytest.fixture
def pdf(coi_samples: Path) -> tuple[str, bytes]:
    f = next(p for p in sample_files(coi_samples) if p.name == PDF_NAME)
    return f.name, f.read_bytes()


def upload(client, pdf, path="/drafts"):
    return client.post(path, files={"file": (pdf[0], pdf[1], "application/pdf")})


def test_health_reports_llm_disabled(client):
    r = client.get("/health")

    assert r.status_code == 200
    assert r.json()["llm"] == "disabled"
    assert r.json()["statuteChunks"] == 5


def test_convert_returns_pure_coi_json(client, pdf):
    r = upload(client, pdf, "/api/v1/convert")

    body = r.json()
    assert r.status_code == 200
    assert set(body) == {"title", "tabs", "flow"}
    assert body["tabs"][-1]["type"] == "FINISH"


def test_convert_with_include_adds_extensions_outside_coi(client, pdf):
    r = client.post("/api/v1/convert?include=meta&include=flags", files={"file": (pdf[0], pdf[1])})

    ext = r.json()["_extensions"]
    assert {"meta", "flags", "aiOutputRef"} <= set(ext)


def test_convert_bad_filename_returns_problem_json_in_polish(client, pdf):
    r = client.post("/api/v1/convert", files={"file": ("zły;plik.pdf", pdf[1])})

    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    assert "niedozwolone znaki" in r.json()["detail"]


def test_convert_png_renamed_to_pdf_returns_415(client):
    r = client.post("/api/v1/convert", files={"file": ("skan.pdf", b"\x89PNG\r\n\x1a\n" + b"\0" * 32)})

    assert r.status_code == 415


def test_convert_batch_returns_zip_with_report(client, pdf):
    r = client.post("/api/v1/convert/batch", files=[("files", pdf), ("files", ("zly;.pdf", pdf[1]))])

    import io
    import json
    import zipfile

    zf = zipfile.ZipFile(io.BytesIO(r.content))
    report = json.loads(zf.read("raport.json"))
    assert r.headers["content-type"] == "application/zip"
    assert [x["ok"] for x in report] == [True, False]


def test_draft_lifecycle_edit_lint_resolve_publish(client, pdf):
    draft_id = upload(client, pdf).json()["draftId"]

    # lista i szczegóły w modelu frontendu
    assert client.get("/drafts").json()[0]["id"] == draft_id
    draft = client.get(f"/drafts/{draft_id}").json()
    assert draft["status"] == "review"
    assert draft["schema"]["issuer"] == "Urząd Gminy Stawiguda"

    # edycja: pole z danymi nadmiarowymi → flaga RODO (error) → publikacja zablokowana
    schema = draft["schema"]
    subject = next(p for p in schema["pages"] if p["title"] not in {"Dane", "Kontakt i zgody"})
    subject["fields"][0]["label"] = "Numer dowodu osobistego"
    edited = client.put(f"/drafts/{draft_id}", json={"schema": schema}).json()
    assert edited["schema"]["pages"][1]["fields"][0]["label"] == "Numer dowodu osobistego"
    flags = client.post(f"/drafts/{draft_id}/lint").json()
    gdpr = next(f for f in flags if f["linter"] == "gdpr" and f["severity"] == "error")

    blocked = client.post(f"/drafts/{draft_id}/publish")
    assert blocked.status_code == 409

    # odrzucenie bez uzasadnienia → 422; z uzasadnieniem → publikacja przechodzi
    assert client.patch(f"/drafts/{draft_id}/flags/{gdpr['id']}", json={"action": "rejected"}).status_code == 422
    ok = client.patch(f"/drafts/{draft_id}/flags/{gdpr['id']}",
                      json={"action": "rejected", "justification": "Wymaga tego regulamin świetlicy."})
    assert ok.json()["resolution"]["by"] == "Anna Nowak"
    published = client.post(f"/drafts/{draft_id}/publish")
    assert published.status_code == 200, published.text

    # czysty COI do pobrania + audit z łańcuchem hashy
    assert set(client.get(f"/drafts/{draft_id}/coi").json()) == {"title", "tabs", "flow"}
    actions = [a["action"] for a in client.get(f"/audit?draftId={draft_id}").json()]
    assert {"upload", "draft_generated", "field_edited", "flag_rejected", "published"} <= set(actions)
    assert client.get("/audit/verify").json() == {"intact": True, "brokenAtSeq": None}


def test_citizen_flow_form_prefill_application_upo(client, pdf):
    draft_id = upload(client, pdf).json()["draftId"]
    client.post(f"/drafts/{draft_id}/publish")
    form = client.get("/forms").json()[0]

    prefill = client.get(f"/prefill?formId={form['id']}").json()
    assert prefill["PESEL.name"] == "Jan"
    assert prefill["MLPZ.email"] == "jan.kowalski@example.com"

    draft = client.post("/applications", json={"formId": form["id"], "formTitle": "x", "status": "draft",
                                                "values": {"imie": "Jan"}}).json()
    sent = client.put(f"/applications/{draft['id']}", json={"formId": form["id"], "formTitle": "x",
                                                             "status": "sent", "values": {"imie": "Jan"}}).json()
    assert sent["confirmationNo"].startswith("UPO/")
    assert client.get("/applications?mine=true").json()[0]["status"] == "sent"
    again = client.put(f"/applications/{draft['id']}", json={"formId": form["id"], "formTitle": "x",
                                                              "status": "draft", "values": {}})
    assert again.status_code == 409


def test_async_upload_streams_progress_events(client, pdf):
    draft_id = client.post("/drafts?async=true", files={"file": pdf}).json()["draftId"]

    with client.stream("GET", f"/drafts/{draft_id}/events") as r:
        text = "".join(r.iter_text())

    import json

    steps = [json.loads(line[5:])["step"] for line in text.splitlines() if line.startswith("data:")]
    assert steps[0] == "upload" and steps[-1] == "done"
    for _ in range(20):
        if client.get(f"/drafts/{draft_id}").status_code == 200:
            break
        time.sleep(0.1)
    assert client.get(f"/drafts/{draft_id}").status_code == 200


def test_coi_import_of_reference_creates_draft(client):
    import json

    from tests.conftest import REFERENCE

    coi = json.loads((REFERENCE / "wzorzec_1_numer_porzadkowy.json").read_text())

    draft_id = client.post("/coi/import", json=coi).json()["draftId"]

    assert client.get(f"/drafts/{draft_id}/coi").json() == coi


def test_dictionaries_include_coi_and_breed_proposal(client):
    names = {d["name"] for d in client.get("/dictionaries").json()}

    assert {"Kraje", "TERYT_DOWODOWY", "RASY_PSOW_AGRESYWNYCH"} <= names
    assert len(client.get("/dictionaries/RASY_PSOW_AGRESYWNYCH").json()["items"]) == 11


def test_auth_enabled_requires_token_and_checks_role(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("JWT_SECRET", "test-secret-test-secret-test-secret!")
    get_settings.cache_clear()

    assert client.get("/drafts").status_code == 401
    citizen = client.post("/auth/token", json={"userId": "u-citizen"}).json()["access_token"]
    official = client.post("/auth/token", json={"userId": "u-official"}).json()["access_token"]
    assert client.get("/drafts", headers={"Authorization": f"Bearer {citizen}"}).status_code == 403
    assert client.get("/drafts", headers={"Authorization": f"Bearer {official}"}).status_code == 200
    assert client.get("/drafts", headers={"Authorization": "Bearer zly-token"}).status_code == 401
