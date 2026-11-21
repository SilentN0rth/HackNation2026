import io

from odf import opendocument, table, teletype, text
from openpyxl import load_workbook

from app.errors import ApiError
from app.extract.ir import Document


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
            for cell in row:
                if cell.value is None:
                    continue
                bold = bool(cell.font and cell.font.b)
                doc.add(str(cell.value), page=number, heading=bold and cell.coordinate in merged_heads, cell=True)
    return doc


def _cell_text(cell) -> str:
    return "\n".join(teletype.extractText(p) for p in cell.getElementsByType(text.P))


def extract_ods(data: bytes) -> Document:
    try:
        source = opendocument.load(io.BytesIO(data))
    except Exception as exc:
        raise ApiError(422, "Nie udało się odczytać pliku ODS.") from exc
    sheets = source.spreadsheet.getElementsByType(table.Table)
    doc = Document(kind="ods", pages=len(sheets))
    for number, sheet in enumerate(sheets, start=1):
        for row in sheet.getElementsByType(table.TableRow):
            for cell in row.getElementsByType(table.TableCell):
                value = _cell_text(cell)
                if value.strip():
                    doc.add(value, page=number, cell=True)
    return doc
