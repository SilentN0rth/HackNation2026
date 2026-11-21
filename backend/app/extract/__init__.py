"""[2] Ekstrakcja: dowolny obsługiwany format → DocumentIR."""

from app.config import Settings
from app.extract.doc import extract_doc
from app.extract.docx import extract_docx
from app.extract.image import ocr_image
from app.extract.ir import Block, DocumentIR
from app.extract.pdf import extract_pdf
from app.extract.sheet import extract_ods, extract_xlsx
from app.uploads import ValidatedUpload

__all__ = ["Block", "DocumentIR", "extract"]


def extract(upload: ValidatedUpload, settings: Settings) -> DocumentIR:
    match upload.kind:
        case "pdf":
            return extract_pdf(upload.data, settings)
        case "docx":
            return extract_docx(upload.data)
        case "xlsx":
            return extract_xlsx(upload.data)
        case "ods":
            return extract_ods(upload.data)
        case "ole":
            return extract_doc(upload.data, settings)
        case "jpeg" | "png":
            return ocr_image(upload.data, settings)
    raise ValueError(f"nieobsługiwany rodzaj {upload.kind}")
