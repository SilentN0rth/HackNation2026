import io

import pdfplumber

from app.config import get_settings
from app.errors import ApiError
from app.extract.image import ocr_image, ocr_available
from app.extract.ir import Document

MIN_TEXT_PER_PAGE = 40


def extract_pdf(data: bytes) -> Document:
    settings = get_settings()
    doc = Document(kind="pdf")
    confidences: list[float] = []
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku PDF.") from exc
    with pdf:
        if len(pdf.pages) > settings.max_pages:
            raise ApiError(422, f"Plik PDF ma więcej niż {settings.max_pages} stron.")
        doc.pages = len(pdf.pages)
        for number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""
            if len(text.strip()) >= MIN_TEXT_PER_PAGE:
                doc.add(text, page=number)
                continue
            if not ocr_available():
                doc.add(text, page=number)
                doc.warnings.append(f"Strona {number} nie ma warstwy tekstowej, a OCR jest niedostępny.")
                continue
            image = page.to_image(resolution=250).original
            ocr = ocr_image(image)
            confidences.append(ocr.ocr_confidence or 0)
            for line in ocr.lines:
                doc.add(line.text, page=number)
    if confidences:
        doc.ocr_confidence = sum(confidences) / len(confidences)
    return doc
