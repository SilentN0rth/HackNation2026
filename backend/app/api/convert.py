"""Minimum COI: plik → JSON COI, bezstanowo. Tryb wsadowy: wiele plików → ZIP z JSON-ami."""

import io
import json
import zipfile
from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import Response

from app.api.deps import IndexDep, LlmDep, SettingsDep, read_upload
from app.coi.builder import slugify
from app.errors import ApiError
from app.security import OfficialUser
from app.understand.pipeline import convert

router = APIRouter(prefix="/api/v1", tags=["convert"])
MAX_BODY = 25 * 1024 * 1024
MAX_BATCH_FILES = 20

Include = Literal["meta", "flags"]


@router.post("/convert", max_body_size=MAX_BODY)
def convert_file(
    file: Annotated[UploadFile, File(description="Formularz: PDF, DOC, DOCX, ODS, XLSX, JPG, PNG")],
    user: OfficialUser,
    settings: SettingsDep,
    llm: LlmDep,
    index: IndexDep,
    include: Annotated[list[Include], Query(description="Dołącz nasze rozszerzenia: meta (cytaty), flags")] = [],  # noqa: B006
) -> dict[str, Any]:
    """Zwraca **czysty JSON COI**. Z `?include=meta,flags` dokleja je pod kluczem `_extensions` (poza COI)."""
    upload = read_upload(file, settings)
    result = convert(upload, settings, llm=llm, index=index)
    body = result.build.coi
    if include:
        ext: dict[str, Any] = {"aiOutputRef": result.form.ai_output_ref, "notes": result.form.notes}
        if "meta" in include:
            ext["meta"] = result.build.meta
        if "flags" in include:
            ext["flags"] = [f.model_dump(exclude_none=True) for f in result.flags]
        body = {**body, "_extensions": ext}
    return body


@router.post("/convert/batch", max_body_size=MAX_BODY * 4, response_class=Response,
             responses={200: {"content": {"application/zip": {}}}})
def convert_batch(
    files: Annotated[list[UploadFile], File(description="Do 20 plików naraz")],
    user: OfficialUser,
    settings: SettingsDep,
    llm: LlmDep,
    index: IndexDep,
) -> Response:
    if len(files) > MAX_BATCH_FILES:
        raise ApiError(422, "Za dużo plików", f"Naraz można przetworzyć najwyżej {MAX_BATCH_FILES} plików.")
    buf = io.BytesIO()
    report: list[dict[str, Any]] = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            try:
                upload = read_upload(f, settings)
                result = convert(upload, settings, llm=llm, index=index)
                name = f"{slugify(upload.filename.rsplit('.', 1)[0])}.json"
                zf.writestr(name, json.dumps(result.build.coi, ensure_ascii=False, indent=2))
                report.append({"file": f.filename, "json": name, "ok": True,
                               "errors": sum(x.severity == "error" for x in result.flags)})
            except ApiError as e:
                report.append({"file": f.filename, "ok": False, "error": e.detail})
        zf.writestr("raport.json", json.dumps(report, ensure_ascii=False, indent=2))
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="formularze_coi.zip"'})
