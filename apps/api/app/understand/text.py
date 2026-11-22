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
    text = strip_numbering(clean(text))
    text = re.sub(r"\((?:[^()]*(?:postaw|zaznacz|wypełni|opisz|wpisz|należy)[^()]*)(?:\)|$)", "", text, flags=re.I)
    text = re.sub(r"^[/(]\s*(.*?)\s*[/)]$", r"\1", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s+\d{1,3}\.?$", "", text)
    text = text.replace("*", "")
    for pattern, replacement in ABBREVIATIONS:
        text = pattern.sub(replacement, text)
    text = SPACES.sub(" ", text).strip(" ,:;-–*/")
    return sentence_case(text)


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
