import re
import unicodedata
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

from app.config import get_settings
from app.errors import ApiError
from app.security import Citizen
from app.uploads import CHUNK, FORBIDDEN_CHARS, MAX_NAME_LENGTH

router = APIRouter(tags=["Obywatel"])

ALLOWED = {".pdf", ".jpg", ".jpeg", ".png", ".xml"}
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
SIGNATURES = {".pdf": (b"%PDF-",), ".png": (b"\x89PNG\r\n\x1a\n",), ".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",)}
ID = re.compile(r"^[0-9a-f]{32}$")


def _clean_name(name: str | None) -> str:
    name = unicodedata.normalize("NFC", (name or "").strip())
    if not name:
        raise ApiError(422, "Plik nie ma nazwy.")
    if len(name) > MAX_NAME_LENGTH:
        raise ApiError(422, f"Nazwa pliku może mieć najwyżej {MAX_NAME_LENGTH} znaków.")
    if any(c in FORBIDDEN_CHARS or unicodedata.category(c) == "Cc" for c in name) or ".." in name:
        raise ApiError(422, "Nazwa pliku zawiera niedozwolone znaki.")
    return name


def _folder(user_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", user_id)
    return get_settings().attachments_dir / safe


@router.post("/attachments", status_code=201, summary="Załącznik do wniosku")
async def upload_attachment(user: Citizen, file: Annotated[UploadFile, File(description="Plik załącznika")]) -> dict:
    name = _clean_name(file.filename)
    extension = Path(name).suffix.lower()
    if extension not in ALLOWED:
        raise ApiError(415, "Dozwolone formaty załączników: PDF, JPG, PNG, XML.")
    data = bytearray()
    while chunk := await file.read(CHUNK):
        data += chunk
        if len(data) > MAX_ATTACHMENT_BYTES:
            raise ApiError(413, "Załącznik może mieć najwyżej 10 MB.")
    if not data:
        raise ApiError(422, "Plik jest pusty.")
    signatures = SIGNATURES.get(extension)
    if signatures and not bytes(data).startswith(signatures):
        raise ApiError(415, "Zawartość pliku nie zgadza się z jego rozszerzeniem.")
    attachment_id = uuid.uuid4().hex
    folder = _folder(user.id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{attachment_id}{extension}").write_bytes(bytes(data))
    return {"id": attachment_id, "name": name, "size": len(data)}


@router.get("/attachments/{attachment_id}", summary="Pobranie własnego załącznika")
def get_attachment(attachment_id: str, user: Citizen) -> FileResponse:
    if not ID.match(attachment_id):
        raise ApiError(404, "Nie ma takiego załącznika.")
    match = next(_folder(user.id).glob(f"{attachment_id}.*"), None)
    if match is None:
        raise ApiError(404, "Nie ma takiego załącznika.")
    return FileResponse(match)
