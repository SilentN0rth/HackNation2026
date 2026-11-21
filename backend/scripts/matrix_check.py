"""Macierz: każdy plik z paczek COI → JSON COI → walidator. Drukuje tabelę wyników.

uv run python scripts/matrix_check.py <katalog z rozpakowanymi paczkami>
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("TESSDATA_PREFIX", str(Path.home() / ".local/share/tessdata"))

from app.coi.builder import build_coi  # noqa: E402
from app.coi.validator import validate_coi  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.extract import extract  # noqa: E402
from app.understand.heuristics import understand  # noqa: E402
from app.uploads import validate_upload  # noqa: E402

root = Path(sys.argv[1])
ok = bad = 0
for f in sorted(root.rglob("*")):
    if not f.is_file() or f.suffix.lower() == ".json" or "wizualizacja" in f.name or f.suffix.lower() == ".zip":
        continue
    if "Materiały do zadania" in str(f):
        continue
    t = time.time()
    try:
        up = validate_upload(f.name, f.read_bytes(), get_settings())
        form = understand(extract(up, get_settings()))
        errs = [i for i in validate_coi(build_coi(form).coi) if i.severity == "error"]
        n = len(form.all_fields())
        status = "OK " if not errs else "ERR"
        ok += not errs
        bad += bool(errs)
        print(f"{status} {time.time() - t:5.1f}s {n:3} pól  {f.parent.name[:3]} {f.suffix:6} {form.title[:60]!r}"
              + (f"  {errs[0].message[:80]}" if errs else ""))
    except Exception as e:
        bad += 1
        print(f"EXC {f.parent.name[:3]} {f.name[-14:]}: {type(e).__name__} {getattr(e, 'detail', e)}")
print(f"\nOK: {ok}  błędy: {bad}")
