"""PDF: pdfplumber (warstwa tekstu); strona bez tekstu → render + OCR."""

import io

import pdfplumber

from app.config import Settings
from app.errors import ApiError
from app.extract.image import ocr_image
from app.extract.ir import DocumentIR, append_lines

MIN_TEXT_CHARS = 50


def extract_pdf(data: bytes, settings: Settings) -> DocumentIR:
    ir = DocumentIR("pdf")
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as e:  # uszkodzony / zaszyfrowany plik
        raise ApiError(422, "Nie udało się odczytać PDF", f"Plik PDF jest uszkodzony lub zaszyfrowany ({e}).") from e
    with pdf:
        if len(pdf.pages) > settings.max_pages:
            raise ApiError(422, "Za dużo stron", f"Dokument ma {len(pdf.pages)} stron, limit to {settings.max_pages}.")
        ir.pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(layout=False) or ""
            if len(text.strip()) >= MIN_TEXT_CHARS:
                append_lines(ir, text.splitlines(), page=i)
                continue
            # skan bez warstwy tekstu
            img = page.to_image(resolution=300).original
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            sub = ocr_image(buf.getvalue(), settings)
            for b in sub.blocks:
                b.page = i
            ir.blocks.extend(sub.blocks)
            ir.ocr_used = True
    return ir
