"""Wycina bloki standardowe (strony „Dane”, „Kontakt i zgody”, „Strona końcowa”) z wzorca COI nr 5.

Uruchomienie: uv run python scripts/extract_blocks.py
Wynik: app/coi/blocks/{dane,kontakt,finish}.json – szablony, w których builder podmienia UUID i nazwę urzędu.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app/coi/reference/wzorzec_5_nadplata_podatku.json"
OUT = ROOT / "app/coi/blocks"

form = json.loads(SRC.read_text())
tabs = {t["title"]: t for t in form["tabs"]}
blocks = {"dane": tabs["Dane"], "kontakt": tabs["Kontakt i zgody"], "finish": tabs["Strona końcowa"]}
OUT.mkdir(parents=True, exist_ok=True)
for name, tab in blocks.items():
    (OUT / f"{name}.json").write_text(json.dumps(tab, ensure_ascii=False, indent=2) + "\n")
    print(name, len(tab["questions"]), "sekcji")
