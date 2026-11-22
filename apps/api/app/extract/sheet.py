import io

from odf import opendocument, style, table, teletype, text
from openpyxl import load_workbook

from app.errors import ApiError
from app.extract.ir import Document

BOX = "□ "
SIDES = ("left", "right", "top", "bottom")
MAX_GAP = 2  # tyle pustych komórek bez ramki może dzielić kwadracik od opisu


def _boxed_texts(row: list[tuple[str, bool]]) -> list[str]:
    """Wiersz arkusza jako (tekst, ramka). Pusta komórka w ramce tuż przed opisem bez ramki to pole do zaznaczenia."""
    result, box_at = [], None
    for index, (value, framed) in enumerate(row):
        if not value.strip():
            if framed:
                box_at = index
            continue
        boxed = box_at is not None and index - box_at <= MAX_GAP + 1 and not framed
        result.append(BOX + value if boxed else value)
        box_at = None
    return result


def _xlsx_framed(cell) -> bool:
    border = cell.border
    return bool(border) and all(getattr(getattr(border, side), "style", None) for side in SIDES)


def extract_xlsx(data: bytes) -> Document:
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=False, data_only=True)
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku XLSX.") from exc
    doc = Document(kind="xlsx", pages=len(workbook.worksheets))
    for number, sheet in enumerate(workbook.worksheets, start=1):
        if sheet.sheet_state != "visible":
            continue
        merged_heads = {r.start_cell.coordinate for r in sheet.merged_cells.ranges if r.max_col - r.min_col >= 3}
        for row in sheet.iter_rows():
            values = [("" if cell.value is None else str(cell.value), _xlsx_framed(cell)) for cell in row]
            texts = iter(_boxed_texts(values))
            for cell in row:
                if cell.value is None or not str(cell.value).strip():
                    continue
                bold = bool(cell.font and cell.font.b)
                doc.add(next(texts), page=number, heading=bold and cell.coordinate in merged_heads, cell=True)
    return doc


def _cell_text(cell) -> str:
    return "\n".join(teletype.extractText(p) for p in cell.getElementsByType(text.P))


def _ods_framed_styles(source) -> set[str]:
    framed = set()
    for node in source.automaticstyles.getElementsByType(style.Style):
        for props in node.getElementsByType(style.TableCellProperties):
            border = props.getAttribute("border")
            sides = [props.getAttribute(f"border{side}") for side in SIDES]
            if (border and border != "none") or all(s and s != "none" for s in sides):
                framed.add(node.getAttribute("name"))
    return framed


def extract_ods(data: bytes) -> Document:
    try:
        source = opendocument.load(io.BytesIO(data))
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku ODS.") from exc
    framed = _ods_framed_styles(source)
    sheets = source.spreadsheet.getElementsByType(table.Table)
    doc = Document(kind="ods", pages=len(sheets))
    for number, sheet in enumerate(sheets, start=1):
        for row in sheet.getElementsByType(table.TableRow):
            cells = [(_cell_text(c), c.getAttribute("stylename") in framed) for c in row.getElementsByType(table.TableCell)]
            for value in _boxed_texts(cells):
                doc.add(value, page=number, cell=True)
    return doc
