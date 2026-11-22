import re
import unicodedata

TRANSLIT = str.maketrans({"ł": "l", "Ł": "L"})
LEADER = re.compile(r"[._…·]{3,}|_{2,}|\s[-–]\s[-–](\s[-–])*\s*$|[`´¨]")
NUMBERING = re.compile(r"^\s*(?:(?:\d{1,2}(?:\.\d{1,2})*\.?)|(?:\d{1,2}\))|(?:[IVXLC]{1,5}\.)|(?:[A-H]\.\d?(?:\.\d)?\.?)|(?:[a-zA-Z]\)))(?:\s+|$)")
CHECKBOX = re.compile(r"[☐☑☒□■▢◻◼❑❒○◯●]|\[\s?[xX]?\s?\]")
SPACES = re.compile(r"\s+")

ABBREVIATIONS = [
    (re.compile(r"\bnr\.?\s", re.I), "numer "),
    (re.compile(r"\bul\.\s?", re.I), "ulica "),
    (re.compile(r"\btel\.\s?", re.I), "telefon "),
    (re.compile(r"\badres poczty elektronicznej\b", re.I), "adres e-mail"),
    (re.compile(r"\bm2\b"), "m²"),
]


def clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Co", "Cn", "Cc"))
    text = CHECKBOX.sub(" ", text)
    text = LEADER.sub(" ", text)
    return SPACES.sub(" ", text).strip(" -–;*")


def starts_with_box(text: str) -> bool:
    head = text.lstrip()[:1]
    return bool(head) and (unicodedata.category(head) == "Co" or bool(CHECKBOX.match(head)))


def strip_numbering(text: str) -> str:
    return NUMBERING.sub("", text).strip()


def is_upper(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return len(letters) >= 3 and sum(c.isupper() for c in letters) / len(letters) > 0.85


def sentence_case(text: str) -> str:
    if is_upper(text):
        text = text.lower()
    return text[:1].upper() + text[1:] if text else text


TITLE_WORDS = {"wniosek", "zgłoszenie", "deklaracja", "oświadczenie", "zawiadomienie", "podanie", "informacja", "karta"}


def normalize_title(text: str) -> str:
    """Tytuł usługi: pojedyncze spacje, zwykły zapis zdania, pierwsze słowo bez kapitalików, bez kropki na końcu."""
    text = sentence_case(SPACES.sub(" ", text.replace("*", "")).strip())
    head, _, rest = text.partition(" ")
    if rest and head.isupper() and head.lower() in TITLE_WORDS and not is_upper(rest):
        text = f"{head.capitalize()} {rest}"
    return text.rstrip(". ")


def plain_label(text: str) -> str:
    return sentence_case(_plain(text))


def plain_heading(text: str) -> str:
    """Nagłówek sekcji: jak etykieta, ale kapitaliki zamienione na zwykły zapis z zachowaniem skrótowców (PESEL, NIP)."""
    return heading_case(_plain(text))


ACRONYMS = {"PESEL", "NIP", "REGON", "KRS", "CEIDG", "VAT", "ZUS", "KRUS", "NFZ", "RODO", "UE", "RP", "PKD", "IBAN", "GUS", "TERYT", "BDO", "PIT", "CIT"}
ONE_LETTER_WORDS = {"A", "I", "O", "U", "W", "Z"}
WORD = re.compile(r"[^\W\d_]+")


def _shouted(word: str) -> bool:
    return len(word) >= 2 and word.isupper() and word not in ACRONYMS


def heading_case(text: str) -> str:
    """Kapitaliki (cały tekst albo ciąg kilku słów) na zwykłe litery; skrótowce zostają wielkimi literami."""
    words = [m.group(0) for m in WORD.finditer(text)]
    if is_upper(text) or any(_shouted(a) and _shouted(b) for a, b in zip(words, words[1:], strict=False)):

        def lower(match: re.Match) -> str:
            word = match.group(0)
            following = WORD.search(text, match.end())
            joined = word in ONE_LETTER_WORDS and following is not None and _shouted(following.group(0))
            return word.lower() if _shouted(word) or joined else word

        text = WORD.sub(lower, text)
    else:
        text = WORD.sub(lambda m: m.group(0).upper() if m.group(0).istitle() and m.group(0).upper() in ACRONYMS else m.group(0), text)
    return text[:1].upper() + text[1:] if text else text


MAX_PAGE_TITLE = 64
DANGLING = {
    "a", "i", "o", "u", "w", "z", "we", "ze", "na", "do", "za", "od", "dla", "przez", "po", "przy", "pod", "nad", "bez",
    "oraz", "lub", "albo", "ani", "że", "który", "która", "które", "których", "jest", "są", "jako", "wraz", "celu",
}
PREPOSITIONS = {"w", "we", "z", "ze", "na", "do", "za", "o", "od", "dla", "przez", "po", "przy", "pod", "nad", "bez", "wraz"}


def _trim_dangling(text: str) -> str:
    words = text.rstrip(" ,;:–-/(").split()
    while len(words) > 1 and words[-1].lower().strip(",;:") in DANGLING:
        words.pop()
    return " ".join(words).rstrip(" ,;:–-/(")


def short_title(text: str, limit: int = MAX_PAGE_TITLE) -> str:
    """Krótki tytuł strony: bez wtrąceń w nawiasach, ucięty na granicy zdania podrzędnego lub przed przyimkiem."""
    if len(text) <= limit:
        return text
    text = SPACES.sub(" ", re.sub(r"\s*\([^()]*\)", "", text)).strip()
    if len(text) <= limit:
        return text
    clause = max((m.start() for m in re.finditer(r",\s|\s[–-]\s|:\s|;\s", text) if 20 <= m.start() <= limit), default=None)
    if clause is not None:
        return _trim_dangling(text[:clause])
    words = text.split()
    kept: list[str] = []
    for word in words:
        if len(" ".join(kept + [word])) > limit:
            break
        kept.append(word)
    cut = max((n for n, w in enumerate(kept) if n >= 3 and w.lower() in PREPOSITIONS), default=None)
    if cut is not None:
        kept = kept[:cut]
    return _trim_dangling(" ".join(kept))


def _plain(text: str) -> str:
    text = strip_numbering(clean(text))
    text = re.sub(r"\((?:[^()]*(?:postaw|zaznacz|wypełni|opisz|wpisz|należy)[^()]*)(?:\)|$)", "", text, flags=re.I)
    text = re.sub(r"^[/(]\s*(.*?)\s*[/)]$", r"\1", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s+\d{1,3}\.?$", "", text)
    text = text.replace("*", "")
    for pattern, replacement in ABBREVIATIONS:
        text = pattern.sub(replacement, text)
    return SPACES.sub(" ", text).strip(" ,:;-–*/")


def slug(text: str, limit: int = 60) -> str:
    text = text.translate(TRANSLIT)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    if len(text) > limit:
        text = text[:limit].rsplit("_", 1)[0] or text[:limit]
    return text or "pole"


def fold(text: str) -> str:
    text = text.translate(TRANSLIT)
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()


KNOWN_SHORT_TITLES = {"dane", "zgody", "zgoda", "kontakt", "adres", "opis", "załączniki"}
JUNK_TITLES = {"tak nie", "tak", "nie", "tak / nie"}


def is_junk_title(title: str) -> bool:
    """Tytuł strony, który wygląda na fragment papierowego formularza (jedno krótkie słowo, „tak nie”)."""
    title = title.strip()
    words = title.split()
    return title.lower() in JUNK_TITLES or (len(words) == 1 and len(title) <= 6 and title.lower() not in KNOWN_SHORT_TITLES)
