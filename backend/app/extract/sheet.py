"""XLSX (openpyxl) i ODS (odfpy, licencja Apache-2.0): niepuste komórki wierszami."""

import io

import openpyxl
from odf import teletype
from odf.opendocument import load as load_ods
from odf.table import Table, TableCell, TableRow

from app.extract.ir import DocumentIR, append_lines

MAX_ROWS = 5000


def _row_lines(cells: list[str]) -> list[str]:
    """Wiersz → linie. Jeśli pierwsza komórka to sama numeracja („1.”), sklejamy ją z następną."""
    cells = [c.strip() for c in cells if c and c.strip() and c.strip() not in {"-", "–"}]
    if len(cells) >= 2 and cells[0].rstrip(".").isdigit() and cells[0].endswith("."):
        cells = [f"{cells[0]} {cells[1]}", *cells[2:]]
    return cells


def extract_xlsx(data: bytes) -> DocumentIR:
    ir = DocumentIR("xlsx")
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    for page, ws in enumerate(wb.worksheets, start=1):
        for r, row in enumerate(ws.iter_rows(values_only=True)):
            if r > MAX_ROWS:
                break
            append_lines(ir, _row_lines([str(v) for v in row if v is not None]), page=page)
    ir.pages = len(wb.worksheets)
    return ir


def extract_ods(data: bytes) -> DocumentIR:
    ir = DocumentIR("ods")
    doc = load_ods(io.BytesIO(data))
    tables = doc.spreadsheet.getElementsByType(Table)
    for page, table in enumerate(tables, start=1):
        for r, row in enumerate(table.getElementsByType(TableRow)):
            if r > MAX_ROWS:
                break
            cells = [teletype.extractText(c) for c in row.getElementsByType(TableCell)]
            append_lines(ir, _row_lines(cells), page=page)
    ir.pages = max(len(tables), 1)
    return ir
