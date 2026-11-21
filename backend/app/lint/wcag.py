"""Linter `wcag` – dostępność i prosty język (reguły z rozdz. 1 „Standardów”), bez LLM."""

import re

from app.lint.base import FieldRef, LintContext, LintFlag, flag, rules

VOWELS = re.compile(r"[aąeęioóuy]+", re.I)
WORD = re.compile(r"[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+")
TAGS = re.compile(r"<[^>]+>")
# „wypełniono”, „podjęto”, „złożono” – formy bezosobowe; lista wyjątków to zwykłe słowa o tej końcówce
IMPERSONAL = ("ono", "ęto", "ito", "yto", "ato", "eto")
NOT_IMPERSONAL = {"miasto", "konto", "zdjęcie", "wrzesień", "ciepło", "lato", "dłuto", "bagno", "żelazo", "złoto",
                  "jezioro", "piętro", "biuro", "gniazdo"}


def syllables(word: str) -> int:
    return len(VOWELS.findall(word))


def _text_checks(ref: FieldRef, text: str, where: str, cfg: dict) -> list[LintFlag]:
    out: list[LintFlag] = []
    words = WORD.findall(text)
    low = text.lower()
    for phrase in cfg["forbidden_phrases"]:
        # jednowyrazowe wpisy to rdzenie („posiad” łapie „posiadasz”, „posiadanie”)
        end = r"\w*" if " " not in phrase and "/" not in phrase else r"(\W|$)"
        if re.search(rf"(^|\W){re.escape(phrase)}{end}", low):
            out.append(flag("wcag", "warning", "Urzędniczy zwrot", f"{where} zawiera zwrot „{phrase}”.", ref,
                            f"{where[:5]}-phrase", evidence=text[:200], suggestion="Napisz to prościej, w 2. osobie."))
            break
    if any(len(w) > 5 and w.lower().endswith(IMPERSONAL) and w.lower() not in NOT_IMPERSONAL for w in words):
        out.append(flag("wcag", "info", "Forma bezosobowa", f"{where} używa formy bezosobowej (np. „-no/-to”).", ref,
                        f"{where[:5]}-impersonal", evidence=text[:200],
                        suggestion="Zwróć się wprost: „podaj”, „wybierz”."))
    if any(w.lower().endswith(tuple(cfg["participle_suffixes"])) and len(w) > 5 for w in words):
        out.append(flag("wcag", "info", "Imiesłów przysłówkowy", f"{where} zawiera imiesłów (np. „wypełniając”).", ref,
                        f"{where[:5]}-participle", evidence=text[:200]))
    long_words = [w for w in words if syllables(w) > cfg["max_syllables"]]
    if len(long_words) > cfg["long_words_allowed"]:
        out.append(flag("wcag", "info", "Długie słowa", f"{where}: {', '.join(long_words[:4])}.", ref,
                        f"{where[:5]}-long", suggestion="Użyj krótszych, codziennych słów."))
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(WORD.findall(sentence)) > cfg["max_sentence_words"]:
            out.append(flag("wcag", "warning", "Za długie zdanie",
                            f"{where} ma zdanie dłuższe niż {cfg['max_sentence_words']} słów.", ref,
                            f"{where[:5]}-sentence", evidence=sentence[:200]))
            break
    return out


def lint_wcag(ctx: LintContext) -> list[LintFlag]:
    cfg = rules()["wcag"]
    out: list[LintFlag] = []
    for ref in ctx.subject_fields():
        f = ref.field
        label = f.get("title", "")
        ftype = f.get("type")
        if not label.strip() and ftype not in {"TEXT_BLOCK", "CONSENT_SECTION"}:
            out.append(flag("wcag", "error", "Pole bez etykiety", "Czytnik ekranu nie odczyta, o co pytamy.", ref,
                            "no-label"))
            continue
        if label.isupper() and len(label) > 3:
            out.append(flag("wcag", "warning", "Tekst wielkimi literami", f"„{label}” – trudniej czytać.", ref,
                            "caps", suggestion=label.capitalize()))
        if len(WORD.findall(label)) > cfg["max_label_words"]:
            out.append(flag("wcag", "warning", "Za długa etykieta",
                            f"Etykieta ma ponad {cfg['max_label_words']} słów – przenieś szczegóły do opisu.", ref,
                            "label-long", evidence=label[:200]))
        if "?" in label and re.search(r"\s(i|oraz|lub|albo)\s", label):
            out.append(flag("wcag", "warning", "Pytanie wielokrotnie złożone",
                            f"„{label}” pyta o kilka rzeczy naraz – rozbij na osobne pola.", ref, "compound"))
        n_opts = len(f.get("options") or [])
        if ftype == "SELECT" and not f.get("dictionaryName") and 0 < n_opts < cfg["select_min_options"]:
            out.append(flag("wcag", "info", "Lista rozwijana z małą liczbą opcji",
                            f"„{label}” ma {n_opts} opcje – lepiej pokazać je jako przyciski wyboru (RADIO).", ref,
                            "select-few", suggestion="Zmień typ na RADIO."))
        if ftype == "RADIO" and n_opts > cfg["radio_max_options"]:
            out.append(flag("wcag", "info", "Za dużo opcji jednokrotnego wyboru",
                            f"„{label}” ma {n_opts} opcji – lepsza będzie lista rozwijana (SELECT).", ref,
                            "radio-many", suggestion="Zmień typ na SELECT."))
        out += _text_checks(ref, label, "Etykieta", cfg)
        desc = TAGS.sub(" ", f.get("description") or "").strip()
        if desc:
            out += _text_checks(ref, desc, "Opis", cfg)
    return out
