"""Podgląd przetwarzania pliku: FormIR (strony/sekcje/pola) + wynik walidatora COI.

uv run python scripts/preview.py <plik> [<plik> …]
"""

import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("TESSDATA_PREFIX", str(Path.home() / ".local/share/tessdata"))

from app.coi.builder import build_coi  # noqa: E402
from app.coi.validator import validate_coi  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.extract import extract  # noqa: E402
from app.understand.heuristics import understand  # noqa: E402
from app.uploads import validate_upload  # noqa: E402

for path in sys.argv[1:]:
    p = Path(path)
    up = validate_upload(p.name, p.read_bytes(), get_settings())
    form = understand(extract(up, get_settings()))
    print(f"### {p.name}\n  TITLE: {form.title!r}  OFFICE: {form.office!r}  STD: {form.standard_blocks}")
    for page in form.pages:
        print(f"  PAGE {page.title!r}")
        for s in page.sections:
            print(f"    SEC {s.title!r}")
            for f in s.fields:
                extra = f" opts={f.options}" if f.options else ""
                cond = f" IF {f.condition.field_key}={f.condition.equals!r}" if f.condition else ""
                val = f" val={f.validators}" if f.validators else ""
                desc = f" desc={f.description!r}" if f.description else ""
                print(f"      {f.key:4} {f.type:13} req={int(f.required)} {f.label!r}{extra}{cond}{val}{desc}")
    if form.legal_basis_text:
        print("  LEGAL:", form.legal_basis_text[:3])
    issues = validate_coi(build_coi(form).coi)
    errors = [i.message for i in issues if i.severity == "error"]
    print("  COI:", dict(Counter(i.severity for i in issues)) or "OK", errors)
