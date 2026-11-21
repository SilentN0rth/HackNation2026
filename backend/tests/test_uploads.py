"""Walidacja uploadu: nazwy, typ po magic bytes, rozmiar, zip bomba."""

import io
import zipfile

import pytest

from app.config import Settings
from app.errors import ApiError
from app.uploads import validate_upload

PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture
def settings() -> Settings:
    return Settings(max_upload_mb=1, max_unzipped_mb=1)


@pytest.mark.parametrize("name", ["wniosek;1.pdf", "a:b.pdf", "a>b.pdf", "a<b.pdf", "a|b.pdf", "a'b.pdf", "a*b.pdf",
                                  "a%b.pdf", "a$b.pdf", "a\\b.pdf", "..\\x.pdf", "a\x01b.pdf"])
def test_validate_upload_forbidden_character_in_name_returns_422(name, settings):
    with pytest.raises(ApiError) as e:
        validate_upload(name, PDF, settings)

    assert e.value.status == 422


def test_validate_upload_name_of_251_chars_returns_422(settings):
    with pytest.raises(ApiError) as e:
        validate_upload("a" * 247 + ".pdf", PDF, settings)

    assert e.value.status == 422


def test_validate_upload_name_of_250_chars_is_accepted(settings):
    assert validate_upload("a" * 246 + ".pdf", PDF, settings).kind == "pdf"


def test_validate_upload_png_renamed_to_pdf_returns_415(settings):
    with pytest.raises(ApiError) as e:
        validate_upload("skan.pdf", PNG, settings)

    assert e.value.status == 415
    assert "nie odpowiada" in e.value.detail


def test_validate_upload_unsupported_extension_returns_415(settings):
    with pytest.raises(ApiError) as e:
        validate_upload("wniosek.exe", PDF, settings)

    assert e.value.status == 415


def test_validate_upload_too_large_file_returns_413(settings):
    with pytest.raises(ApiError) as e:
        validate_upload("duzy.pdf", PDF + b"0" * (2 * 1024 * 1024), settings)

    assert e.value.status == 413


def test_validate_upload_empty_file_returns_422(settings):
    with pytest.raises(ApiError) as e:
        validate_upload("pusty.pdf", b"", settings)

    assert e.value.status == 422


def test_validate_upload_zip_bomb_docx_returns_422(settings):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", b"0" * (5 * 1024 * 1024))  # 5 MB rozpakowane, limit 1 MB
    with pytest.raises(ApiError) as e:
        validate_upload("bomba.docx", buf.getvalue(), settings)

    assert e.value.status == 422
    assert "zip bomb" in e.value.detail


def test_validate_upload_docx_saved_as_doc_is_accepted(settings):
    """Tak jest w materiałach COI (formularz 7) – treść parsujemy według wykrytego typu."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", "<w:document/>")

    assert validate_upload("wniosek.DOC", buf.getvalue(), settings).kind == "docx"


def test_validate_upload_returns_sha256_and_keeps_name(settings):
    up = validate_upload("wniosek.pdf", PDF, settings)

    assert len(up.sha256) == 64
    assert up.filename == "wniosek.pdf"
