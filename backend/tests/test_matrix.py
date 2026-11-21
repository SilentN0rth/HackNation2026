"""Macierz „nowych plików”: 9 formularzy × wszystkie formaty → JSON przechodzący walidator COI.

Uruchamiane osobno (OCR trwa): uv run pytest -m slow
"""

from pathlib import Path

import pytest

from app.coi.builder import build_coi
from app.coi.validator import validate_coi
from app.config import Settings
from app.extract import extract
from app.understand.heuristics import understand
from app.uploads import validate_upload
from tests.conftest import sample_files

pytestmark = pytest.mark.slow


def test_matrix_every_sample_file_converts_to_valid_coi(coi_samples: Path):
    settings = Settings()
    files = sample_files(coi_samples)
    failures: list[str] = []

    for f in files:
        try:
            form = understand(extract(validate_upload(f.name, f.read_bytes(), settings), settings))
            errs = [i.message for i in validate_coi(build_coi(form).coi) if i.severity == "error"]
            if errs:
                failures.append(f"{f.name}: {errs[0]}")
        except Exception as e:  # noqa: BLE001
            failures.append(f"{f.name}: {type(e).__name__}: {e}")

    assert len(files) >= 60, f"za mało plików testowych ({len(files)})"
    assert failures == []


def test_matrix_every_form_has_subject_fields_in_pdf(coi_samples: Path):
    settings = Settings()
    pdfs = [f for f in sample_files(coi_samples) if f.suffix.lower() == ".pdf"]

    empty = [f.name for f in pdfs
             if not understand(extract(validate_upload(f.name, f.read_bytes(), settings), settings)).all_fields()]

    assert empty == []
