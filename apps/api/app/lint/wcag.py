import re

from app.coi.walk import INPUT_TYPES, leaves
from app.lint.base import Flag
from app.understand.text import is_upper

LINTER = "wcag"
STANDARD_TABS = {"Dane", "Kontakt i zgody", "Strona końcowa"}
FORBIDDEN = {
    "dokonać": "zrobić",
    "dokonania": "zrobienia",
    "posiadać": "mieć",
    "posiada": "ma",
    "pragnąć": "chcieć",
    "informujemy": "pomiń wstęp i przejdź do rzeczy",
    "niniejszy": "ten",
    "niniejszym": "tym",
    "winien": "powinien",
    "celem": "aby",
    "w/w": "wymieniony",
    "tut.": "tego",
}
IMPERSONAL = re.compile(r"\b\w+(no|to)\b(?=\s|$)", re.I)
IMPERSONAL_OK = {"to", "tylko", "dobro", "konto", "auto", "lato", "miasto", "pismo", "święto", "zero", "sito", "data", "około", "metro", "biuro", "warto", "jeszcze", "zło", "wino", "okno", "sprawozdano"}


def _words(text: str) -> list[str]:
    return re.findall(r"[\wąćęłńóśźż/.-]+", text, re.I)


def run(coi: dict) -> list[Flag]:
    flags: list[Flag] = []
    for item in leaves(coi):
        field = item.field
        if field.get("type") not in INPUT_TYPES or item.tab.get("title") in STANDARD_TABS:
            continue
        title = field.get("title") or ""
        tech = field.get("techName")
        page, fid = item.tab.get("id"), field.get("id")
        if not title.strip():
            flags.append(Flag(f"{LINTER}:{tech}:empty", LINTER, "error", "Pole bez etykiety", "Czytnik ekranu nie odczyta, czego dotyczy to pole.", page, fid, suggestion="Dodaj krótką etykietę."))
            continue
        words = _words(title)
        if len(words) > 20:
            flags.append(Flag(f"{LINTER}:{tech}:long", LINTER, "warning", "Za długie pytanie", f"Pytanie ma {len(words)} słów. Prosty język zaleca do 20.", page, fid, evidence=title, suggestion="Skróć pytanie, a szczegóły przenieś do podpowiedzi."))
        if is_upper(title) and len(title.split()) >= 2:
            flags.append(Flag(f"{LINTER}:{tech}:caps", LINTER, "warning", "Tekst wielkimi literami", "Tekst pisany wielkimi literami trudniej się czyta.", page, fid, evidence=title, suggestion="Zapisz tekst zwykłymi literami."))
        lowered = title.lower()
        for word, better in FORBIDDEN.items():
            if re.search(rf"(?<![\w]){re.escape(word)}(?![\w])", lowered):
                flags.append(Flag(f"{LINTER}:{tech}:word:{word}", LINTER, "info", f"Urzędowe słowo „{word}”", "Prosty język zaleca słowa codzienne.", page, fid, evidence=title, suggestion=f"Zamiast „{word}” napisz „{better}”."))
        if "?" in title and re.search(r"\b(i|oraz)\b", lowered) and title.count(",") + lowered.count(" oraz ") + lowered.count(" i ") >= 2:
            flags.append(Flag(f"{LINTER}:{tech}:compound", LINTER, "warning", "Pytanie wielokrotnie złożone", "Jedno pytanie dotyczy kilku rzeczy naraz.", page, fid, evidence=title, suggestion="Podziel je na osobne pytania."))
        impersonal = [w for w in IMPERSONAL.findall(lowered) if w]
        if impersonal and any(m.group(0) not in IMPERSONAL_OK and len(m.group(0)) > 5 for m in IMPERSONAL.finditer(lowered)):
            flags.append(Flag(f"{LINTER}:{tech}:impersonal", LINTER, "info", "Forma bezosobowa", "Formy typu „złożono”, „wpisano” brzmią urzędowo.", page, fid, evidence=title, suggestion="Zwróć się bezpośrednio: „Wpisz…”, „Wybierz…”."))
        options = field.get("options") or []
        if field.get("type") == "SELECT" and 0 < len(options) <= 5:
            flags.append(Flag(f"{LINTER}:{tech}:select", LINTER, "info", "Lista z kilkoma opcjami", "Przy pięciu lub mniej opcjach lepiej pokazać je wszystkie naraz.", page, fid, suggestion="Zmień typ pola na jednokrotny wybór (RADIO)."))
        if field.get("type") == "RADIO" and len(options) > 5:
            flags.append(Flag(f"{LINTER}:{tech}:radio", LINTER, "info", "Za dużo opcji do wyboru", "Przy więcej niż pięciu opcjach lista rozwijana jest czytelniejsza.", page, fid, suggestion="Zmień typ pola na listę rozwijaną (SELECT)."))
    return flags
