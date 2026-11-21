import io
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import PurePath

from fastapi import UploadFile

from app.config import get_settings
from app.errors import ApiError

FORBIDDEN_CHARS = set(";:></\\|'*%$")
MAX_NAME_LENGTH = 250
CHUNK = 1024 * 256

OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
ZIP = b"PK\x03\x04"
PDF = b"%PDF-"
PNG = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8\xff"

KIND_BY_EXTENSION = {
    ".pdf": "pdf",
    ".doc": "doc",
    ".docx": "docx",
    ".ods": "ods",
    ".xlsx": "xlsx",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
}

COMPATIBLE = {"doc": {"doc", "docx"}, "docx": {"docx", "doc"}}

MIME_BY_KIND = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@dataclass(frozen=True)
class UploadedFile:
    name: str
    extension: str
    kind: str
    mime: str
    data: bytes


def validate_filename(name: str | None) -> str:
    if not name or not name.strip():
        raise ApiError(422, "Plik nie ma nazwy.")
    name = unicodedata.normalize("NFC", name.strip())
    if len(name) > MAX_NAME_LENGTH:
        raise ApiError(422, f"Nazwa pliku może mieć najwyżej {MAX_NAME_LENGTH} znaków.")
    bad = sorted({c for c in name if c in FORBIDDEN_CHARS})
    if bad:
        raise ApiError(422, f"Nazwa pliku zawiera niedozwolone znaki: {' '.join(bad)}")
    if any(unicodedata.category(c) == "Cc" for c in name) or ".." in name:
        raise ApiError(422, "Nazwa pliku zawiera niedozwolone znaki.")
    extension = PurePath(name).suffix.lower()
    if extension not in get_settings().allowed_extensions or extension not in KIND_BY_EXTENSION:
        allowed = ", ".join(e.lstrip(".").upper() for e in get_settings().allowed_extensions)
        raise ApiError(415, f"Nieobsługiwany format pliku. Dozwolone: {allowed}.")
    return extension


def _zip_kind(data: bytes) -> str | None:
    settings = get_settings()
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 5000:
                raise ApiError(422, "Plik zawiera zbyt wiele elementów.")
            if sum(e.file_size for e in entries) > settings.max_unpacked_bytes:
                raise ApiError(422, "Plik po rozpakowaniu jest zbyt duży.")
            names = {e.filename for e in entries}
            if "mimetype" in names:
                mimetype = archive.read("mimetype")[:100].decode("ascii", "ignore").strip()
                if mimetype == MIME_BY_KIND["ods"]:
                    return "ods"
            if "word/document.xml" in names:
                return "docx"
            if "xl/workbook.xml" in names:
                return "xlsx"
    except zipfile.BadZipFile:
        return None
    return None


def sniff(data: bytes) -> tuple[str | None, str | None]:
    if data.startswith(PDF) or PDF in data[:1024]:
        return "pdf", MIME_BY_KIND["pdf"]
    if data.startswith(PNG):
        return "image", "image/png"
    if data.startswith(JPEG):
        return "image", "image/jpeg"
    if data.startswith(OLE):
        return "doc", MIME_BY_KIND["doc"]
    if data.startswith(ZIP):
        kind = _zip_kind(data)
        return kind, MIME_BY_KIND.get(kind or "")
    return None, None


def check_content(name: str, data: bytes) -> UploadedFile:
    extension = validate_filename(name)
    if not data:
        raise ApiError(422, "Plik jest pusty.")
    kind, mime = sniff(data)
    expected = KIND_BY_EXTENSION[extension]
    if kind is None or mime is None:
        raise ApiError(415, "Nie rozpoznano zawartości pliku. Prześlij formularz w obsługiwanym formacie.")
    if kind not in COMPATIBLE.get(expected, {expected}):
        raise ApiError(415, "Zawartość pliku nie zgadza się z jego rozszerzeniem.")
    if kind == "image" and mime == "image/png" and extension != ".png":
        raise ApiError(415, "Zawartość pliku nie zgadza się z jego rozszerzeniem.")
    if kind == "image" and mime == "image/jpeg" and extension not in (".jpg", ".jpeg"):
        raise ApiError(415, "Zawartość pliku nie zgadza się z jego rozszerzeniem.")
    return UploadedFile(name=name, extension=extension, kind=kind, mime=mime, data=data)


async def read_upload(upload: UploadFile) -> UploadedFile:
    validate_filename(upload.filename)
    limit = get_settings().max_upload_bytes
    buffer = io.BytesIO()
    while chunk := await upload.read(CHUNK):
        buffer.write(chunk)
        if buffer.tell() > limit:
            raise ApiError(413, f"Plik jest większy niż {get_settings().max_upload_mb:g} MB.")
    return check_content(upload.filename or "", buffer.getvalue())
