"""Załączniki obywatela: limit 10 MB, formaty, zgodność zawartości z rozszerzeniem, dostęp tylko do własnych."""

import pytest

from app.api import attachments
from tests.conftest import token

PDF = b"%PDF-1.4\n%test\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20


def upload(client, headers, name="pelnomocnictwo.pdf", data=PDF):
    return client.post("/attachments", headers=headers, files={"file": (name, data)})


def test_requires_citizen_token(client, official):
    assert client.post("/attachments", files={"file": ("a.pdf", PDF)}).status_code == 401
    assert upload(client, official).status_code == 403


@pytest.mark.parametrize(("name", "data"), [("a.pdf", PDF), ("b.png", PNG), ("c.JPG", b"\xff\xd8\xff\xe0abc"), ("d.xml", b"<a/>")])
def test_accepts_allowed_formats(client, citizen, name, data):
    response = upload(client, citizen, name, data)
    assert response.status_code == 201
    assert response.json()["name"] == name and response.json()["size"] == len(data)


@pytest.mark.parametrize("name", ["a.exe", "b.docx", "c.html", "d"])
def test_rejects_other_formats(client, citizen, name):
    assert upload(client, citizen, name, b"abc").status_code == 415


def test_rejects_content_not_matching_extension(client, citizen):
    assert upload(client, citizen, "fałszywy.pdf", b"MZ\x90\x00").status_code == 415


def test_rejects_empty_file(client, citizen):
    assert upload(client, citizen, "pusty.pdf", b"").status_code == 422


def test_rejects_too_large_file(client, citizen, monkeypatch):
    monkeypatch.setattr(attachments, "MAX_ATTACHMENT_BYTES", 1024)
    response = upload(client, citizen, "duzy.pdf", PDF + b"0" * 2000)
    assert response.status_code == 413 and "10 MB" in response.json()["detail"]


def test_rejects_forbidden_characters_in_name(client, citizen):
    assert upload(client, citizen, "a;b.pdf", PDF).status_code == 422


def test_owner_can_download_but_others_cannot(client, citizen):
    created = upload(client, citizen).json()
    assert client.get(f"/attachments/{created['id']}", headers=citizen).content == PDF
    other = token(client, "u-urzednik")
    assert client.get(f"/attachments/{created['id']}", headers=other).status_code == 403


def test_unknown_or_malformed_id_is_404(client, citizen):
    assert client.get("/attachments/" + "0" * 32, headers=citizen).status_code == 404
    assert client.get("/attachments/..%2Fetc", headers=citizen).status_code == 404
