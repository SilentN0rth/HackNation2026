# COI – Cyfryzacja formularzy: backend

Stary formularz urzędowy (**PDF, DOC, DOCX, ODS, XLSX, JPG, PNG**) → **JSON w formacie COI**, z podstawą prawną pól
i sześcioma linterami. FastAPI 0.165, Python 3.14, SQLite, Tesseract, opcjonalnie lokalny LLM (Ollama).

Architektura: [`../docs/ARCHITEKTURA.md`](../docs/ARCHITEKTURA.md) · plan: [`../BACKEND_PLAN.md`](../BACKEND_PLAN.md)

## Szybki start

```bash
# lokalnie (wymaga: uv, tesseract + model „pol”)
cd backend
uv sync
uv run fastapi dev                      # http://localhost:8000, opis API: http://localhost:8000/docs

# minimum COI – jeden plik → JSON COI
curl -F file=@"Wniosek o zwrot opłaty skarbowej.pdf" http://localhost:8000/api/v1/convert
```

Polski model OCR (macOS/Homebrew ma w formule tylko `eng`):
`curl -L -o ~/.local/share/tessdata/pol.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/pol.traineddata`
i `export TESSDATA_PREFIX=~/.local/share/tessdata` (skopiuj tam też `eng`/`osd`). W obrazie Docker: pakiet `tesseract-ocr-pol`.

## Docker (zalecane do oceny)

```bash
mkdir -p secrets && openssl rand -base64 48 > secrets/jwt_secret   # sekret podawany w runtime, nie w obrazie
docker compose up --build                                          # API :8000 + frontend :3000
docker compose --profile llm up -d && ./backend/scripts/pull_model.sh qwen3:4b   # opcjonalnie: LLM
```

- Obrazy przypięte po **digest** (`python:3.14-slim-bookworm@sha256:…`, `node:24-bookworm-slim@sha256:…`,
  `ollama/ollama:0.13.5@sha256:…`), bez `latest`.
- API działa jako użytkownik **10001**, `read_only: true`, `cap_drop: ALL`, `no-new-privileges`,
  pliki tymczasowe tylko na **tmpfs** (`/tmp` w RAM), `HEALTHCHECK` na `/health`.
- **Debian slim zamiast Alpine:** Tesseract, LibreOffice i koła Pythona (rapidfuzz, lxml, pillow) działają na glibc.
  Na musl trzeba by je kompilować ze źródeł, a obraz wcale nie byłby mniejszy.
- LibreOffice (DOC→DOCX) jest **opcjonalny** (`--build-arg WITH_LIBREOFFICE=true`, ~400 MB). Bez niego pliki DOC czyta
  własny parser formatu Word 97 (`app/extract/doc.py`, olefile/BSD) – przechodzi wszystkie pliki DOC z materiałów COI.
- Bez Ollamy (`LLM_ENABLED=false`) API działa w trybie heurystycznym – tańsze wdrożenie, bez GPU.

## Konfiguracja (zmienne środowiskowe)

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `MAX_UPLOAD_MB` | `20` | limit rozmiaru pliku (czytany strumieniowo, przerwanie po przekroczeniu) |
| `MAX_PAGES` | `30` | limit stron PDF |
| `MAX_UNZIPPED_MB` | `200` | limit rozpakowania DOCX/XLSX/ODS (ochrona przed zip bombą) |
| `ALLOWED_EXTENSIONS` | `[".pdf",".doc",".docx",".ods",".xlsx",".jpg",".jpeg",".jpe",".png"]` | dozwolone rozszerzenia (JSON) |
| `AUTH_ENABLED` | `false` | `true` = wymagany `Authorization: Bearer <JWT>` |
| `JWT_SECRET` / plik `/run/secrets/jwt_secret` | – | sekret HS256 (wymagany przy `AUTH_ENABLED=true`) |
| `JWT_TTL_MIN` | `480` | ważność tokenu |
| `LLM_ENABLED` | `false` | włącza poprawę „Przedmiotu wniosku” i lintera trafności cytatów przez LLM |
| `OLLAMA_URL` | `http://localhost:11434` | adres Ollamy |
| `LLM_MODEL` | `qwen3:4b` | model (Apache-2.0); alternatywa: Bielik 11B v2.x |
| `LLM_TIMEOUT_S` | `60` | timeout na sekcję – po nim zostaje wynik heurystyk |
| `OCR_LANG` | `pol` | język Tesseracta |
| `SOFFICE_BIN` | `soffice` | LibreOffice do konwersji DOC (jeśli zainstalowany) |
| `CORS_ORIGINS` | `["http://localhost:3000","http://localhost:3100"]` | dozwolone originy frontendu |
| `DB_PATH` | `data/coi.sqlite3` | baza SQLite |
| `DATA_DIR` | `data/` | słowniki, korpus ustaw, makieta danych inicjalnych |

## API

Pełny opis (OpenAPI) pod **`/docs`**. Błędy: `application/problem+json` (RFC 9457) z polskim komunikatem
(413 za duży plik, 415 zły typ / niezgodna zawartość, 422 zła nazwa, 409 publikacja z nierozwiązanymi flagami).

| Metoda i ścieżka | Rola | Opis |
|---|---|---|
| `POST /api/v1/convert` | urzędnik | **Minimum COI**: `file` → czysty JSON COI. `?include=meta&include=flags` dokleja `_extensions` |
| `POST /api/v1/convert/batch` | urzędnik | do 20 plików → ZIP z JSON-ami + `raport.json` |
| `GET /health` | – | status API, LLM (`disabled/up/down`), liczba fragmentów ustaw |
| `POST /auth/token` · `GET /me` | – / każdy | makieta logowania (węzeł krajowy), bieżący użytkownik |
| `POST /drafts` (`?async=true`) · `GET /drafts/{id}/events` | urzędnik | upload → wersja robocza; postęp przez SSE |
| `GET /drafts` · `GET /drafts/{id}` · `PUT /drafts/{id}` | urzędnik | lista, szczegóły (model frontendu), zapis → nowa wersja + lint |
| `GET /drafts/{id}/coi` | urzędnik | czysty JSON COI do pobrania |
| `POST /drafts/{id}/lint` · `PATCH /drafts/{id}/flags/{flagId}` | urzędnik | lintery; „poprawione” / „odrzucone z uzasadnieniem” |
| `POST /drafts/{id}/publish` | urzędnik | publikacja – **409**, gdy zostały nierozwiązane flagi `error` |
| `GET /drafts/{id}/statute-chunks` | urzędnik | fragmenty ustaw powiązane z polami |
| `GET /audit?draftId=` · `GET /audit/verify` | urzędnik | Audit Trail, weryfikacja łańcucha hashy |
| `POST /coi/import` | urzędnik | gotowy JSON COI → edytor (round-trip) |
| `GET /dictionaries` · `GET /dictionaries/{name}` | każdy | słowniki COI + **propozycja nowego słownika** (rasy psów agresywnych) |
| `GET /forms` · `GET /forms/{id}` · `GET /prefill?formId=` | obywatel | e-usługi, makieta danych inicjalnych (MLPZ/PESEL, dane fikcyjne) |
| `GET/POST/PUT /applications` | obywatel | wnioski obywatela, numer UPO (makieta) |

## Jak to działa (skrót)

1. **Walidacja uploadu** – rozszerzenie **i** typ po magic bytes **i** ich zgodność, nazwa ≤ 250 znaków bez
   `; : > < / \ | ' * % $`, limit rozmiaru, zip bomba. Plik żyje tylko w pamięci; w bazie zostaje sha256 i nazwa.
2. **Ekstrakcja** do wspólnego `DocumentIR`: pdfplumber (+OCR dla stron bez tekstu), python-docx (z polami tekstowymi),
   openpyxl, odfpy, parser DOC, Tesseract (wysokie skany cięte na strony A4).
3. **Rozumienie** – heurystyki + katalog pól `app/understand/field_catalog.yaml` (**edytowalny bez programowania**).
   Dane wnioskodawcy, adres i kontakt zastępuje **blok standardowy** wycięty z wzorców COI (strony „Dane” i
   „Kontakt i zgody”). Opcjonalnie LLM poprawia „Przedmiot wniosku” sekcja po sekcji (structured outputs,
   `temperature 0`, stały seed); timeout → zostaje wynik heurystyk.
4. **Builder COI** – deterministyczne UUID, siatka 3 kolumn, `techName`, warunki JSONata (`states: SHOW`), `flow.links`.
5. **Walidator reguł COI** + **lintery**: `coi-rules`, `static-graph`, `exact-match` (deterministyczne – „AI napisało,
   kod sprawdził”), `citation-relevance` (LLM), `gdpr`, `wcag` (prosty język, reguły w `app/lint/rules.yaml`).
6. **SQLite** – wersje robocze z historią, flagi z rozstrzygnięciami, publikacje, wnioski; **Audit Trail tylko do
   dopisywania z łańcuchem hashy** (zmiana dowolnego wpisu jest wykrywana przez `GET /audit/verify`).

### Decyzje przy niejasnościach formatu (BACKEND_PLAN.md, sekcja 9)

Domyślnie **jak we wzorcowych JSON-ach COI** (to one przeszły import): klucz `repeatingSectionGrid` (schemat ma
literówkę `repetingSectionGrid`), strona końcowa `SECTION` + `TEXT_BLOCK` (walidator zgłasza to jako `info`),
`validation` jako tablica nazw (`["REQUIRED", "PESEL"]`), słowniki `Kraje`, `TERYT_DOWODOWY`, `TERYT_4G_DOWODOWY`.
Akceptujemy też DOCX zapisany z rozszerzeniem `.doc` i rozszerzenie `.jpe` – tak jest w materiałach COI (formularz 7).

## Testy i jakość

```bash
uv run pytest -m "not slow"     # 88 testów: walidator, upload, lintery, round-trip, heurystyki, LLM (atrapa), API
uv run pytest -m slow           # macierz: 9 formularzy × wszystkie formaty (69 plików) → JSON zgodny z COI
uv run python scripts/eval.py   # zgodność z wzorcowymi JSON-ami (formularze 1 i 5)
uv run python scripts/batch_convert.py   # wynikowe JSON-y → ../outputs/
uv run ruff check app scripts tests
```

Wynik `eval.py` (tryb heurystyczny, bez LLM, 15 plików formularzy 1 i 5): **cały formularz – recall pól 90%,
zgodność typów 100%, słowniki 100%**; sam „Przedmiot wniosku” (bez bloków standardowych) – recall 34%, typy 67%.
To tę część ma poprawiać LLM. Formularze 8 i 9 nie były używane do strojenia heurystyk (hold-out).

## Licencje

Wszystkie zależności na licencjach permisywnych (MIT/BSD/Apache-2.0/ISC/PSF), sprawdzone `pip-licenses`.
Uwagi:
- **odfpy** – licencja potrójna Apache-2.0 / GPL / LGPL – **korzystamy z Apache-2.0**.
- **certifi** – MPL-2.0 (słaby copyleft na poziomie pliku, używany bez zmian).
- **LibreOffice** (opcjonalny) – MPL-2.0, uruchamiany jako osobny proces, bez linkowania.
- **Tesseract** + dane `pol` – Apache-2.0. **Ollama** – MIT, **Qwen3** – Apache-2.0.
- Celowo **nie używamy**: PyMuPDF (AGPL), psycopg2 (LGPL), antiword (GPL), modeli Llama (licencja niestandardowa).

## Ścieżka wdrożeniowa: PostgreSQL

`app/store/db.py` używa wyłącznie standardowego SQL (bez rozszerzeń SQLite poza triggerami append-only).
Migracja: podmienić `Database` na pulę połączeń (np. `psycopg` w trybie binarnym w osobnym serwisie lub SQLModel),
`AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`, triggery `RAISE(ABORT)` → `RAISE EXCEPTION` w PL/pgSQL.

## Korpus ustaw

`data/statutes/*.txt` – teksty jednolite z ISAP/ELI pobrane **przed** demo (format: [`data/statutes/README.md`](data/statutes/README.md)).
Bez korpusu działa wszystko poza podpowiedzią „Dlaczego pytamy?” i sprawdzaniem cytatów (linter zgłasza wtedy `info`).
