import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.coi.quality import summary  # noqa: E402
from app.coi.validator import errors  # noqa: E402
from app.errors import ApiError  # noqa: E402
from app.pipeline import convert  # noqa: E402
from app.understand.text import slug  # noqa: E402
from app.uploads import check_content  # noqa: E402

PREFERRED = (".pdf", ".docx", ".odt", ".ods", ".xlsx", ".doc", ".png", ".jpg", ".jpeg")


MIN_FIELDS = 3


def candidates(archive: zipfile.ZipFile) -> list[str]:
    names = [n for n in archive.namelist() if not n.endswith("/") and "wizualizacja" not in n and not n.lower().endswith(".json")]
    return [name for extension in PREFERRED for name in names if name.lower().endswith(extension)]


def specific_fields(coi: dict) -> int:
    return sum(len(q["field"].get("repeatingSectionGrid") or []) for t in coi["tabs"][1:-2] for q in t["questions"])


def best(archive: zipfile.ZipFile):
    results = []
    for name in candidates(archive):
        try:
            result = convert(check_content(Path(name).name, archive.read(name)))
        except ApiError:
            continue
        if specific_fields(result.coi) >= MIN_FIELDS:
            return name, result
        results.append((specific_fields(result.coi), name, result))
    if not results:
        return None, None
    _, name, result = max(results, key=lambda r: r[0])
    return name, result


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parents[1] / "data-pdf"
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT.parents[1] / "outputs"
    target.mkdir(parents=True, exist_ok=True)
    report = []
    for archive_path in sorted(source.glob("[0-9]*.zip")):
        number = archive_path.name.split(".", 1)[0]
        with zipfile.ZipFile(archive_path) as archive:
            name, result = best(archive)
        if result is None:
            report.append({"formularz": number, "status": "nie udało się przetworzyć żadnego pliku"})
            continue
        output = target / f"{int(number):02d}_{slug(result.coi['title'], 70)}.json"
        output.write_text(json.dumps(result.coi, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report.append(
            {
                "formularz": number,
                "plik": Path(name).name,
                "wynik": output.name,
                "strony": len(result.coi["tabs"]),
                "bledyCOI": len(errors(result.coi)),
                "uwagi": len(result.flags),
                "jakosc": summary(result.coi),
            }
        )
        print(f"{output.name}: {len(result.coi['tabs'])} stron, {len(result.flags)} uwag")
    (target / "raport.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
