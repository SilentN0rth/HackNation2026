"""Porównanie z wzorcowym JSON-em COI (formularze 1 i 5) – liczba na slajd.

Dla każdego formatu formularza liczy:
  • recall etykiet pól (dopasowanie rozmyte ≥ 80) – osobno dla CAŁEGO formularza i dla samego „Przedmiotu wniosku”
    (strony spoza bloków standardowych; bloki standardowe są ze wzorca, więc zawyżałyby wynik),
  • zgodność typów i walidatorów dla dopasowanych pól.

uv run python scripts/eval.py
"""

import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("TESSDATA_PREFIX", str(Path.home() / ".local/share/tessdata"))

from app.config import get_settings  # noqa: E402
from app.understand.pipeline import convert  # noqa: E402
from app.uploads import validate_upload  # noqa: E402

STANDARD_TABS = {"Dane", "Kontakt i zgody", "Kontakt z urzędem", "Strona końcowa"}
CASES = {"1.": "wzorzec_1_numer_porzadkowy.json", "5.": "wzorzec_5_nadplata_podatku.json"}
SKIP_TYPES = {"TEXT_BLOCK", "INFO_SECTION", "CONSENT_SECTION"}


def fields(coi: dict, subject_only: bool) -> list[dict]:
    return [c["field"] for t in coi["tabs"] if not (subject_only and t["title"] in STANDARD_TABS)
            for q in t["questions"] for c in q["field"]["repeatingSectionGrid"] if c["field"]["type"] not in SKIP_TYPES]


def compare(ref: dict, out: dict, subject_only: bool) -> dict[str, float]:
    ref_f, out_f = fields(ref, subject_only), fields(out, subject_only)
    used: set[int] = set()
    matched: list[tuple[dict, dict]] = []
    for r in ref_f:
        best, best_i = 0.0, -1
        for i, o in enumerate(out_f):
            if i in used:
                continue
            s = fuzz.token_set_ratio(r["title"].lower(), o["title"].lower())
            if s > best:
                best, best_i = s, i
        if best >= 80:
            used.add(best_i)
            matched.append((r, out_f[best_i]))
    n = len(ref_f) or 1
    m = len(matched) or 1
    return {
        "ref": len(ref_f),
        "out": len(out_f),
        "recall": len(matched) / n,
        "precision": len(matched) / (len(out_f) or 1),
        "type": sum(r["type"] == o["type"] for r, o in matched) / m,
        "dict": sum(r.get("dictionaryName") == o.get("dictionaryName") for r, o in matched) / m,
    }


def main() -> None:
    settings = get_settings()
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for prefix, ref_name in CASES.items():
            ref = json.loads((ROOT / "app/coi/reference" / ref_name).read_text())
            z = next(p for p in (ROOT.parent / "data-pdf").glob("*.zip") if p.name.startswith(prefix))
            with zipfile.ZipFile(z) as zf:
                zf.extractall(Path(tmp) / prefix)
            for f in sorted((Path(tmp) / prefix).rglob("*")):
                if not f.is_file() or f.suffix.lower() in {".json", ".zip"} or "wizualizacja" in f.name:
                    continue
                out = convert(validate_upload(f.name, f.read_bytes(), settings), settings).build.coi
                full, subj = compare(ref, out, False), compare(ref, out, True)
                rows.append((prefix, f.suffix.lower(), full, subj))
                print(f"{prefix} {f.suffix.lower():6} cały: recall {full['recall']:.0%} typy {full['type']:.0%} | "
                      f"przedmiot: recall {subj['recall']:.0%} ({subj['ref']} pól wzorca, {subj['out']} naszych), "
                      f"typy {subj['type']:.0%}")
    avg = lambda key, part: sum(r[part][key] for r in rows) / len(rows)  # noqa: E731
    print(f"\nŚREDNIO ({len(rows)} plików): cały formularz – recall {avg('recall', 2):.0%}, "
          f"zgodność typów {avg('type', 2):.0%}, słowniki {avg('dict', 2):.0%}; "
          f"sam przedmiot wniosku – recall {avg('recall', 3):.0%}, typy {avg('type', 3):.0%}")


if __name__ == "__main__":
    main()
