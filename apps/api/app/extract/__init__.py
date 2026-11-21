from app.extract.doc import extract_doc
from app.extract.docx import extract_docx
from app.extract.image import extract_image
from app.extract.ir import Document, Line
from app.extract.pdf import extract_pdf
from app.extract.sheet import extract_ods, extract_xlsx
from app.uploads import UploadedFile

EXTRACTORS = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "doc": extract_doc,
    "xlsx": extract_xlsx,
    "ods": extract_ods,
    "image": extract_image,
}


def extract(upload: UploadedFile) -> Document:
    return EXTRACTORS[upload.kind](upload.data)


__all__ = ["Document", "Line", "extract"]
