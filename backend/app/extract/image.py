"""JPG/PNG: Tesseract (pol, --psm 4) z pewnością per linia (średnia pewność słów)."""

import io
from collections import defaultdict

import pytesseract
from PIL import Image, ImageOps

from app.config import Settings
from app.errors import ApiError
from app.extract.ir import DocumentIR, make_block

MAX_WIDTH = 2480  # A4 przy 300 dpi – szerzej nie poprawia OCR, a spowalnia
Image.MAX_IMAGE_PIXELS = 250_000_000  # powyżej: DecompressionBombError (ochrona przed bombą)


def ocr_image(data: bytes, settings: Settings) -> DocumentIR:
    ir = DocumentIR("image", ocr_used=True)
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("L")
        if img.width > MAX_WIDTH:
            img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.Resampling.LANCZOS)
    except Image.DecompressionBombError as e:
        raise ApiError(422, "Za duży obraz", "Obraz ma zbyt dużą rozdzielczość.") from e
    except Exception as e:
        raise ApiError(422, "Nie udało się odczytać obrazu", f"Plik obrazu jest uszkodzony ({e}).") from e

    for page, tile in enumerate(_split_pages(img), start=1):
        _ocr_tile(tile, page, ir, settings)
    ir.pages = max((b.page for b in ir.blocks), default=1)
    return ir


def _split_pages(img: Image.Image) -> list[Image.Image]:
    """Wysoki skan (wiele stron jedna pod drugą) → kawałki ~A4, cięte w najjaśniejszym (pustym) wierszu.

    Tesseract nie przyjmuje obrazów wyższych niż 32767 px, a wąskie kawałki i tak rozpoznaje lepiej.
    """
    page_h = round(img.width * 1.4142)
    if img.height <= page_h * 1.2:
        return [img]
    tiles: list[Image.Image] = []
    top = 0
    window = page_h // 10
    while top < img.height:
        target = top + page_h
        if target >= img.height:
            tiles.append(img.crop((0, top, img.width, img.height)))
            break
        band = img.crop((0, target - window, img.width, target + window))
        # suma jasności wierszy – szukamy najjaśniejszego (pustego) wiersza w okolicy cięcia
        w = band.width
        rows = [sum(band.crop((0, y, w, y + 1)).getdata()) for y in range(0, band.height, 4)]
        cut = target - window + rows.index(max(rows)) * 4
        tiles.append(img.crop((0, top, img.width, cut)))
        top = cut
    return tiles


def _ocr_tile(img: Image.Image, page: int, ir: DocumentIR, settings: Settings) -> None:
    try:
        data_dict = pytesseract.image_to_data(
            img, lang=settings.ocr_lang, config="--psm 4", output_type=pytesseract.Output.DICT
        )
    except pytesseract.TesseractNotFoundError as e:
        raise ApiError(503, "OCR niedostępny", "Tesseract nie jest zainstalowany na serwerze.") from e

    lines: dict[tuple[int, int, int], list[tuple[str, float]]] = defaultdict(list)
    for i, word in enumerate(data_dict["text"]):
        word = (word or "").strip()
        conf = float(data_dict["conf"][i])
        if not word or conf < 0:
            continue
        key = (data_dict["block_num"][i], data_dict["par_num"][i], data_dict["line_num"][i])
        lines[key].append((word, conf))

    for key in sorted(lines):
        words = lines[key]
        conf = sum(c for _, c in words) / len(words) / 100
        b = make_block(" ".join(w for w, _ in words), page=page, confidence=round(conf, 3))
        if b:
            ir.blocks.append(b)
