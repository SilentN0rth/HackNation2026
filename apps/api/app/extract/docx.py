import io

from docx import Document as load_docx
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

from app.errors import ApiError
from app.extract.ir import Document

FALLBACK = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
CELL = qn("w:tc")
# Punktory listy rysowane jako kwadracik do zaznaczenia (Symbol/Wingdings i Unicode). Zwykłe punktory (•, ▪) tu nie należą.
BOX_BULLETS = {"□", "☐", "❑", "❒", "◻", "\uf06f", "\uf071", "\uf0a8", "\uf092", "\uf0fd", "\uf0fe"}


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


def _box_levels(source) -> set[tuple[str, str]]:
    """Pary (numId, ilvl), których punktorem jest kwadracik – takie akapity to opcje do zaznaczenia."""
    try:
        numbering = source.part.numbering_part.element
    except (KeyError, NotImplementedError, AttributeError):
        return set()
    abstract: dict[str, set[str]] = {}
    for node in numbering.iter(qn("w:abstractNum")):
        levels = set()
        for lvl in node.iter(qn("w:lvl")):
            fmt, glyph = lvl.find(qn("w:numFmt")), lvl.find(qn("w:lvlText"))
            if fmt is not None and fmt.get(qn("w:val")) == "bullet" and glyph is not None and glyph.get(qn("w:val")) in BOX_BULLETS:
                levels.add(lvl.get(qn("w:ilvl")))
        abstract[node.get(qn("w:abstractNumId"))] = levels
    boxes = set()
    for num in numbering.iter(qn("w:num")):
        ref = num.find(qn("w:abstractNumId"))
        for level in abstract.get(ref.get(qn("w:val")) if ref is not None else "", set()):
            boxes.add((num.get(qn("w:numId")), level))
    return boxes


def _boxed(element, boxes: set[tuple[str, str]]) -> bool:
    num = element.find(f"{qn('w:pPr')}/{qn('w:numPr')}")
    if num is None:
        return False
    num_id, level = num.find(qn("w:numId")), num.find(qn("w:ilvl"))
    key = (num_id.get(qn("w:val")) if num_id is not None else "", level.get(qn("w:val")) if level is not None else "0")
    return key in boxes


def extract_docx(data: bytes) -> Document:
    try:
        source = load_docx(io.BytesIO(data))
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku DOCX.") from exc
    doc = Document(kind="docx")
    boxes = _box_levels(source)
    for element in source.element.body.iter(qn("w:p")):
        chain = list(_ancestors(element))
        if any(a.tag == FALLBACK for a in chain):
            continue
        paragraph = Paragraph(element, source._body)
        text = paragraph.text
        if text.strip() and _boxed(element, boxes):
            text = f"□ {text}"
        doc.add(text, heading=_is_heading(paragraph), cell=any(a.tag == CELL for a in chain))
    return doc
