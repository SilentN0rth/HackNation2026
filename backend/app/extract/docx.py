"""DOCX: akapity w kolejności dokumentu, także w polach tekstowych i tabelach.

Pola tekstowe Worda występują w XML dwa razy (mc:Choice + mc:Fallback/VML) – bierzemy jedną kopię.
Akapit, który zawiera inne akapity (kontener pola tekstowego), pomijamy, bo jego tekst powtarzałby dzieci.
"""

import io

import docx
from docx.oxml.ns import qn

from app.extract.ir import DocumentIR, append_lines

MC_FALLBACK = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
W_P = qn("w:p")
W_T = qn("w:t")
W_TAB = qn("w:tab")
W_BR = qn("w:br")
W_TC = qn("w:tc")


def _inside_fallback(el) -> bool:
    parent = el.getparent()
    while parent is not None:
        if parent.tag == MC_FALLBACK:
            return True
        parent = parent.getparent()
    return False


def _paragraph_text(p) -> str:
    parts: list[str] = []
    for el in p.iter(W_T, W_TAB, W_BR):
        if el.tag == W_T:
            parts.append(el.text or "")
        else:
            parts.append(" ")
    return "".join(parts)


def extract_docx(data: bytes) -> DocumentIR:
    ir = DocumentIR("docx")
    document = docx.Document(io.BytesIO(data))
    body = document.element.body
    lines: list[str] = []
    for p in body.iter(W_P):
        if _inside_fallback(p) or any(True for _ in p.iterdescendants(W_P)):
            continue
        lines.append(_paragraph_text(p))
    append_lines(ir, lines)
    return ir
