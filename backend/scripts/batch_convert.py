"""Wynikowe pliki JSON do zgłoszenia: każdy formularz z data-pdf → outputs/<nazwa>.json (+ raport).

Bierze po jednym pliku na formularz, w kolejności preferencji formatów (najlepsza warstwa tekstu najpierw).

uv run python scripts/batch_convert.py [--all-formats]
"""

import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("TESSDATA_PREFIX", str(Path.home() / ".local/share/tessdata"))

from app.coi.builder import slugify  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.understand.pipeline import convert  # noqa: E402
from app.uploads import validate_upload  # noqa: E402

PREFERENCE = [".pdf", ".docx", ".doc", ".xlsx", ".ods", ".png", ".jpg", ".jpeg", ".jpe"]
OUT = ROOT.parent / "outputs"


def main() -> None:
    all_formats = "--all-formats" in sys.argv
    OUT.mkdir(exist_ok=True)
    settings = get_settings()
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for z in sorted((ROOT.parent / "data-pdf").glob("*.zip")):
            if z.name.startswith("Materiały"):
                continue
            target = Path(tmp) / z.stem
            with zipfile.ZipFile(z) as zf:
                zf.extractall(target)
            files = [p for p in target.rglob("*") if p.is_file() and p.suffix.lower() in PREFERENCE
                     and "wizualizacja" not in p.name]
            files.sort(key=lambda p: PREFERENCE.index(p.suffix.lower()))
            for f in files if all_formats else files[:1]:
                up = validate_upload(f.name, f.read_bytes(), settings)
                r = convert(up, settings)
                number = z.name.split(".")[0]
                suffix = f"_{f.suffix.lower().lstrip('.')}" if all_formats else ""
                name = f"{number}_{slugify(r.build.coi['title'])[:60]}{suffix}.json"
                (OUT / name).write_text(json.dumps(r.build.coi, ensure_ascii=False, indent=2) + "\n")
                errors = sum(fl.severity == "error" for fl in r.flags)
                report.append({"plik": f.name, "json": name, "pola_przedmiotu": len(r.form.all_fields()),
                               "flagi_error": errors, "flagi_razem": len(r.flags), "ai": r.form.ai_output_ref})
                print(f"{name:80} pól: {len(r.form.all_fields()):3}  flag: {len(r.flags):3} (error: {errors})")
    (OUT / "raport.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"\nZapisano {len(report)} plików w {OUT}")


if __name__ == "__main__":
    main()
