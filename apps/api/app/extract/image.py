import io
import shutil

from PIL import Image, ImageOps

from app.config import get_settings
from app.errors import ApiError
from app.extract.ir import Document

Image.MAX_IMAGE_PIXELS = 60_000_000


def ocr_available() -> bool:
    return shutil.which(get_settings().tesseract_cmd) is not None


def _prepare(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("L")
    if image.width < 1800:
        scale = 1800 / image.width
        image = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
    return image


def ocr_image(image: Image.Image) -> Document:
    import pytesseract

    settings = get_settings()
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    prepared = _prepare(image)
    data = pytesseract.image_to_data(
        prepared,
        lang=settings.ocr_lang,
        config="--psm 4",
        output_type=pytesseract.Output.DICT,
        timeout=settings.converter_timeout_s,
    )
    doc = Document(kind="image")
    rows: dict[tuple[int, int, int], list[str]] = {}
    confidences: list[float] = []
    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        conf = float(data["conf"][i])
        if not word or conf < 0:
            continue
        confidences.append(conf)
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        rows.setdefault(key, []).append(word)
    for key in sorted(rows):
        doc.add(" ".join(rows[key]))
    doc.ocr_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0.0
    return doc


def extract_image(data: bytes) -> Document:
    if not ocr_available():
        raise ApiError(503, "Rozpoznawanie tekstu ze skanów (OCR) jest niedostępne na tym serwerze.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać obrazu.") from exc
    return ocr_image(image)
