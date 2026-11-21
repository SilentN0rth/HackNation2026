# Architektura – Cyfryzacja formularzy (HackNation 2026, COI)

## Kontekst

```
 Urzędnik ──► Frontend (Next.js 16, HeroUI, Zod) ──HTTP/JSON + SSE──► API (FastAPI) ──► SQLite
 Obywatel ──►        │                                                   │
                     └──── mocki (NEXT_PUBLIC_USE_MOCKS=true) ────────────┤──► Tesseract (OCR, proces)
                                                                          ├──► LibreOffice (opcjonalnie, proces)
                                                                          └──► Ollama + Qwen3 (opcjonalnie, lokalnie)
```

Bez zewnętrznych API w trakcie działania: teksty ustaw, słowniki i model LLM są lokalne.

## Przetwarzanie pliku (pipeline)

```
plik ──► [1] Walidacja uploadu ──► [2] Ekstrakcja ──► DocumentIR (linie: tekst, strona, rodzaj, pewność OCR)
         rozszerzenie + magic bytes      PDF  pdfplumber (+OCR stron bez tekstu)
         nazwa, rozmiar, zip bomba       DOCX python-docx (też pola tekstowe)
         (tylko w pamięci)               XLSX openpyxl · ODS odfpy · DOC parser Word97/LibreOffice
                                         JPG/PNG Tesseract „pol” (wysokie skany → strony A4)
                                                    │
                     ┌──────────────────────────────┴──────────────────────────────┐
                     ▼                                                             ▼
          [3a] Heurystyki + katalog pól (YAML)                         [3b] LLM (Ollama, opcjonalnie)
          nagłówki 1./2.1./I., pola „do wykropkowania”,                 tylko „Przedmiot wniosku”, sekcja po sekcji,
          podpowiedzi (…)/…/, wybory, „Jeśli wybierzesz…”,               JSON Schema w `format`, temperature 0, seed;
          oświadczenia, załączniki, przypisy „nieobowiązkowe”            timeout → zostaje wynik heurystyk
                     └──────────────────────────────┬──────────────────────────────┘
                                                    ▼
                                            FormIR (model pośredni)
                                                    │  + BM25 na korpusie ustaw → podstawa prawna (dosłowny cytat)
                                                    ▼
          [4] Builder COI: bloki standardowe („Dane”, „Kontakt i zgody”, „Strona końcowa” – wycięte z wzorców COI)
              + strony przedmiotu wniosku, UUID (deterministyczne), siatka 3 kolumn, techName, JSONata SHOW, flow
                                                    ▼
          [5] Walidator reguł COI (Pydantic + „Reguły techniczne”)
                                                    ▼
          [6] Lintery ──► flagi (id deterministyczne: <linter>:<techName>[:<reguła>])
              coi-rules · static-graph (networkx + symulacja JSONata) · exact-match   ← kod, bez LLM
              citation-relevance (LLM) · gdpr · wcag (prosty język)
                                                    ▼
          [7] SQLite: wersje robocze + wersje + flagi + Audit Trail (łańcuch hashy, append-only)
                                                    ▼
          GET /drafts/{id}/coi  →  czysty JSON COI (bez naszych rozszerzeń – meta trzymamy osobno)
```

## Model danych

- **Kanoniczny model = JSON COI + `meta`** (`techName → {legalBasis, confidence, source, needsReview}`).
  Rozszerzenia nigdy nie trafiają do eksportu COI.
- **Mapowanie na frontend** w jednym miejscu: `backend/app/mapping/frontend.py`. Zapis z edytora nakłada zmiany
  na ostatnią wersję COI po `techName` (bezstratny round-trip – test `tests/test_roundtrip.py`).
- Frontend waliduje każdą odpowiedź API schematami Zod (`frontend/src/types`) – niezgodność kontraktu daje
  czytelny błąd zamiast cichego `undefined`.

## Zaufanie i bezpieczeństwo

| Obszar | Rozwiązanie |
|---|---|
| Halucynacje AI | 3 lintery deterministyczne; cytaty sprawdzane z tekstem ustawy (rapidfuzz ≥ 95 = zgodny) |
| Decyzja człowieka | publikacja zablokowana (409), dopóki każda flaga `error` nie jest poprawiona albo odrzucona z uzasadnieniem |
| Rozliczalność | Audit Trail: kto, kiedy, jaki wynik AI (`model@digest#sha256(prompt)`), łańcuch hashy + triggery append-only |
| Pliki | tylko w pamięci; tymczasowe pliki dla OCR/LibreOffice na tmpfs, usuwane w `finally` |
| Kontener | non-root (10001), read-only FS, `cap_drop: ALL`, obrazy po digest, sekret JWT z Docker secrets |
| RODO | linter minimalizacji danych; dane inicjalne (MLPZ/PESEL) tylko po zgodzie obywatela (makieta) |

## Uproszczenia względem tablicy (świadome)

| Na tablicy | U nas | Dlaczego |
|---|---|---|
| Qdrant/pgvector | BM25 w pamięci | korpus to kilka ustaw; mniej kontenerów = niższy koszt |
| PostgreSQL | SQLite | zero konfiguracji; ścieżka migracji w `backend/README.md` |
| API ISAP/ELI na żywo | pliki w `backend/data/statutes/` | zakaz zewnętrznych API |
