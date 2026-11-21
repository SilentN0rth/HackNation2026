import io

from docx import Document as load_docx
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

from app.errors import ApiError
from app.extract.ir import Document

FALLBACK = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
CELL = qn("w:tc")


def _is_heading(paragraph: Paragraph) -> bool:
    try:
        style = (paragraph.style.name if paragraph.style is not None else "") or ""
    except (AttributeError, KeyError):
        style = ""
    if style.lower().startswith(("heading", "nagłówek", "title", "tytuł")):
        return True
    runs = [r for r in paragraph.runs if r.text.strip()]
    return bool(runs) and all(r.bold for r in runs) and len(paragraph.text) < 120


def _ancestors(element):
    parent = element.getparent()
    while parent is not None:
        yield parent
        parent = parent.getparent()


def extract_docx(data: bytes) -> Document:
    try:
        source = load_docx(io.BytesIO(data))
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku DOCX.") from exc
    doc = Document(kind="docx")
    for element in source.element.body.iter(qn("w:p")):
        chain = list(_ancestors(element))
        if any(a.tag == FALLBACK for a in chain):
            continue
        paragraph = Paragraph(element, source._body)
        doc.add(paragraph.text, heading=_is_heading(paragraph), cell=any(a.tag == CELL for a in chain))
    return doc
