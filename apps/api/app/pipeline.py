import hashlib
from dataclasses import dataclass, field

from app import lint
from app.coi.builder import build
from app.extract import extract
from app.understand.heuristics import understand
from app.understand.llm import refine
from app.uploads import UploadedFile


@dataclass
class Result:
    coi: dict
    meta: dict
    flags: list[dict]
    sha256: str
    issuer: str
    legal_basis: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    model: str | None = None
    ocr_confidence: float | None = None


def convert(upload: UploadedFile, issuer: str | None = None) -> Result:
    document = extract(upload)
    form = understand(document, upload.name)
    model = refine(form)
    coi, meta = build(form, issuer)
    flags = lint.run(coi, meta)
    issuer_name = next(
        (
            c["field"].get("defaultValue")
            for q in coi["tabs"][0]["questions"]
            for c in q["field"].get("repeatingSectionGrid") or []
            if c["field"].get("techName") in ("nazwa_urzedu", "nazwa_organu")
        ),
        issuer or "",
    )
    return Result(
        coi=coi,
        meta=meta,
        flags=flags,
        sha256=hashlib.sha256(upload.data).hexdigest(),
        issuer=issuer_name,
        legal_basis=form.legal_basis,
        warnings=form.warnings,
        model=model,
        ocr_confidence=form.ocr_confidence,
    )
