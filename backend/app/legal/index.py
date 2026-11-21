"""BM25 w pamięci na korpusie ustaw (kilka aktów – wektory nic nie dają, a to jeden kontener mniej).

Służy do: (1) podpowiedzi podstawy prawnej dla pola („Dlaczego pytamy?”), (2) lintera exact-match.
Cytat jest zawsze DOSŁOWNYM fragmentem tekstu aktu (zdanie z najlepszego fragmentu), więc exact-match go potwierdzi.
"""

import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from rank_bm25 import BM25Okapi
from rapidfuzz import fuzz

from app.config import get_settings
from app.legal.parser import StatuteChunk, load_corpus

_TOKEN = re.compile(r"[a-ząćęłńóśźż0-9]+")
_STOP = {"i", "w", "z", "o", "na", "do", "lub", "oraz", "się", "nie", "że", "to", "jest", "od", "dla", "przez", "ze"}
_NORM_QUOTES = str.maketrans({"„": '"', "”": '"', "“": '"', "’": "'", "–": "-", "—": "-", " ": " "})


def tokens(text: str) -> list[str]:
    # prosty „stemming”: pierwsze 6 liter – polska fleksja psuje dopasowanie całych słów
    return [t[:6] for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 1]


def normalize(text: str) -> str:
    t = text.translate(_NORM_QUOTES)
    t = re.sub(r"-\s*\n\s*", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


@dataclass
class Hit:
    chunk: StatuteChunk
    score: float
    quote: str


class LegalIndex:
    def __init__(self, chunks: list[StatuteChunk]) -> None:
        self.chunks = chunks
        self.by_id = {c.id: c for c in chunks}
        self._bm25 = BM25Okapi([tokens(c.unit + " " + c.text) for c in chunks]) if chunks else None
        self._norm_texts = [normalize(c.text) for c in chunks]

    @property
    def empty(self) -> bool:
        return not self.chunks

    def search(self, query: str, k: int = 3, acts: list[str] | None = None) -> list[Hit]:
        if self._bm25 is None:
            return []
        q = tokens(query)
        if not q:
            return []
        scores = self._bm25.get_scores(q)
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        hits: list[Hit] = []
        for i in order:
            if scores[i] <= 0:
                break
            c = self.chunks[i]
            if acts and not any(fuzz.partial_ratio(a.lower(), c.act.lower()) >= 85 for a in acts):
                continue
            hits.append(Hit(c, float(scores[i]), best_sentence(c.text, q)))
            if len(hits) >= k:
                break
        return hits

    def find_quote(self, quote: str) -> tuple[float, StatuteChunk | None]:
        """Najlepsze dopasowanie cytatu w korpusie: (wynik 0–100, fragment)."""
        nq = normalize(quote)
        if not nq or not self.chunks:
            return 0.0, None
        best, best_chunk = 0.0, None
        for text, chunk in zip(self._norm_texts, self.chunks, strict=True):
            if nq in text:
                return 100.0, chunk
            s = fuzz.partial_ratio(nq, text) if len(nq) <= len(text) else fuzz.ratio(nq, text)
            if s > best:
                best, best_chunk = s, chunk
        return best, best_chunk


def best_sentence(text: str, query_tokens: list[str]) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.;:])\s+", text) if s.strip()]
    if not sentences:
        return text[:300]
    qs = set(query_tokens)
    best = max(sentences, key=lambda s: len(qs & set(tokens(s))))
    return best[:400]


@cache
def get_index() -> LegalIndex:
    return LegalIndex(load_corpus(Path(get_settings().data_dir) / "statutes"))
