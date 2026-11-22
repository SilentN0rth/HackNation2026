"""Sprawdza pliki wynikowe w outputs/: reguły techniczne (błędy) i jakość (ostrzeżenia).

Kod wyjścia 1, gdy którykolwiek plik ma błąd COI albo ostrzeżenie spoza listy znanych ograniczeń.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.coi.quality import quality  # noqa: E402
from app.coi.validator import errors, validate  # noqa: E402

# Ograniczenia źródeł, których generator nie rozwiąże sam (opisane w docs/OTWARTE_PROBLEMY.md).
KNOWN = {("06", "organ-name"), ("09", "long-title")}


def main() -> int:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parents[1] / "outputs"
    failed = False
    for path in sorted(folder.glob("0*.json")):
        coi = json.loads(path.read_text(encoding="utf-8"))
        hard = errors(coi)
        warnings = [i for i in [*validate(coi), *quality(coi)] if i.severity == "warning" and (path.name[:2], i.code) not in KNOWN]
        status = "OK" if not hard and not warnings else "BŁĄD"
        print(f"{path.name[:2]} {status}: błędy {len(hard)}, ostrzeżenia {len(warnings)}")
        for issue in [*hard, *warnings]:
            print(f"   {issue.severity} {issue.code}: {issue.message}")
        failed = failed or bool(hard or warnings)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
