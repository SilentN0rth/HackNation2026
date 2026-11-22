import io
import json
import zipfile
from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.errors import ApiError
from app.pipeline import convert
from app.security import Converter
from app.uploads import read_upload

router = APIRouter(prefix="/api/v1", tags=["Konwersja"])
MAX_BATCH = 20


@router.post(
    "/convert",
    summary="Zamiana formularza na JSON COI",
    description=(
        "Przyjmuje jeden plik (PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG, PNG) i zwraca konfigurację formularza "
        "w formacie JSON gotową do importu. Parametr include=meta,flags dokleja źródła pól i wyniki kontroli jakości."
    ),
)
async def convert_file(
    user: Converter,
    file: Annotated[UploadFile, File(description="Blankiet formularza")],
    issuer: Annotated[str | None, Form(description="Nazwa urzędu, gdy nie da się jej odczytać z pliku")] = None,
    include: Annotated[str | None, Query(description="meta, flags")] = None,
) -> dict:
    upload = await read_upload(file)
    result = await run_in_threadpool(convert, upload, issuer)
    extras = {part.strip() for part in (include or "").split(",") if part.strip()}
    if not extras:
        return result.coi
    body: dict = {"form": result.coi}
    if "meta" in extras:
        body["meta"] = {
            "fields": result.meta,
            "issuer": result.issuer,
            "legalBasis": result.legal_basis,
            "warnings": result.warnings,
            "model": result.model,
            "ocrConfidence": result.ocr_confidence,
            "sha256": result.sha256,
        }
    if "flags" in extras:
        body["flags"] = result.flags
    return body


@router.post(
    "/convert/batch",
    summary="Zamiana wielu formularzy naraz",
    description="Przyjmuje do 20 plików i zwraca archiwum ZIP z plikami JSON COI oraz raportem.",
    response_class=StreamingResponse,
)
async def convert_batch(user: Converter, files: Annotated[list[UploadFile], File(description="Blankiety formularzy")]) -> StreamingResponse:
    if not files:
        raise ApiError(422, "Nie przesłano żadnego pliku.")
    if len(files) > MAX_BATCH:
        raise ApiError(422, f"Można przesłać najwyżej {MAX_BATCH} plików naraz.")
    buffer = io.BytesIO()
    report = []
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for upload_file in files:
            name = upload_file.filename or "plik"
            try:
                upload = await read_upload(upload_file)
                result = await run_in_threadpool(convert, upload, None)
            except ApiError as exc:
                report.append({"plik": name, "status": "błąd", "komunikat": exc.detail})
                continue
            target = f"{PurePath(name).stem}.json"
            archive.writestr(target, json.dumps(result.coi, ensure_ascii=False, indent=2))
            errors = sum(1 for f in result.flags if f["severity"] == "error")
            report.append({"plik": name, "status": "ok", "wynik": target, "uwagiKrytyczne": errors})
        archive.writestr("raport.json", json.dumps(report, ensure_ascii=False, indent=2))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="formularze.zip"'},
    )
