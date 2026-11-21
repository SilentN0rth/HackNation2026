# Plan realizacji backendu – Cyfryzacja Formularzy (COI)

Stan na sobotę 21.11.2026, 15:40. Uzupełnia `PLAN.md` (frontend) i `PODSUMOWANIE.md`.

---

## 0. Trzy ustalenia, które zmieniają plan

1. **Format JSON COI już mamy.** Jest w repozytorium w `data-pdf/Materiały do zadania dla Uczestników.zip`:
   - `importowanyPlikJsonSchemat.json` – JSON Schema,
   - `OpisImportowanegoPlikuJSON.docx` – opis każdego klucza,
   - `Reguły techniczne konfiguracji formularzy….docx` – reguły obowiązkowe,
   - dwa **wzorcowe JSON-y** w paczkach 1 i 5 (`konfiguracja_form_*.json`), każdy razem z oryginałem w 8 formatach.

   Ryzyko „nie znamy formatu” z podsumowania jest nieaktualne. Pozostałe niejasności są w sekcji 9.
2. **Na wejściu minimum jest stary formularz, nie ustawa.** Jury wgra plik PDF/DOC/DOCX/ODS/XLSX/JPG/PNG i oczekuje JSON-a COI. Ścieżka z ustawą i cytatami to **nasz wyróżnik na górze minimum**, nie zamiast niego.
3. **Wzorcowe JSON-y mają stały szkielet** zgodny z dokumentem „Standardy i dobre praktyki”:

   | Strona | Typ | Zawartość |
   |---|---|---|
   | Dane | MAIN | urząd (tylko do odczytu), podmiot wniosku, twoje dane (MLPZ), adres (Polska/zagranica + słowniki), pełnomocnictwo, opłata skarbowa |
   | Przedmiot wniosku (1..n) | MAIN | **jedyna część naprawdę specyficzna dla formularza** |
   | Kontakt z urzędem / zgody | MAIN | telefon i e-mail (MLPZ), sekcja zgód |
   | Strona końcowa | FINISH | podgląd i podsumowanie |

   **Wniosek:** budujemy JSON **hybrydowo**. Standardowe sekcje składamy deterministycznie z gotowych bloków, wyciętych z wzorców. LLM uzupełnia tylko „Przedmiot wniosku” i proste nazwy pól. Dzięki temu wynik jest zgodny z COI, system działa także bez LLM (tryb awaryjny), a na obronie z nowymi plikami nie zależymy od humorów modelu.

---

## 1. Architektura

```
plik ──► [1] Walidacja uploadu ──► [2] Ekstrakcja ──► DocumentIR
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
          [3a] Heurystyki + katalog pól               [3b] LLM (Ollama, lokalnie)
          (Imię, PESEL, adres, NIP, kwota…)           tylko nierozpoznane pola,
                     │                                 podział na sekcje, prosty język
                     └─────────────────────┬─────────────────────┘
                                           ▼
                                   FormIR (pośredni)
                                           ▼
          [4] Builder COI: bloki standardowe + UUID + siatka x/y/cols + questionOrder
              + flow.links + generator zapytań JSONata (states SHOW)
                                           ▼
                     [5] Walidator reguł COI (Pydantic + reguły techniczne)
                                           ▼
                     [6] Lintery (6 sprawdzeń) ──► flagi
                                           ▼
                     [7] Draft w SQLite + wersje + Audit Trail (łańcuch hashy)
                                           ▼
              GET /drafts/{id}/coi  →  czysty JSON COI (bez naszych rozszerzeń)
```

**Kanoniczny model w backendzie = JSON COI + `meta`**, czyli mapa `fieldId → {legalBasis, confidence, sourceSpan}`. Nasze rozszerzenia (cytat, pewność, fragment źródła) nigdy nie trafiają do eksportu COI. Mapowanie na model frontendu (`FormSchema`) robi backend w jednym miejscu: `app/mapping/frontend.py`. Frontendowy `adapters.ts` może zostać „przezroczysty”.

### Co celowo upraszczamy względem tablicy w Figmie

| Na tablicy | W backendzie | Dlaczego |
|---|---|---|
| Qdrant / pgvector + embeddingi | **BM25 w pamięci** (`rank-bm25`) na kilku ustawach z repo | Korpus to kilka ustaw, więc wektory nic nie dają. Mniej kontenerów to niższy koszt (kryterium 20%). |
| PostgreSQL | **SQLite** (biblioteka standardowa) | Zero konfiguracji. Unikamy też `psycopg` (LGPL). Migracja do Postgresa jest opisana w README jako ścieżka wdrożeniowa. |
| Ustawa → formularz jako główna ścieżka | Formularz → COI, a ustawa jako źródło cytatów do „Dlaczego pytamy?” i lintera | Tak brzmi minimum i tak będzie wyglądać test na obronie. |
| API ISAP/ELI na żywo | Teksty ustaw pobrane wcześniej do `backend/data/statutes/` | Zakaz zewnętrznych API. |

---

## 2. Stack i licencje (sprawdzone na PyPI 21.11)

| Warstwa | Biblioteka | Licencja |
|---|---|---|
| API | FastAPI 0.165, uvicorn, python-multipart, pydantic-settings | MIT / BSD / Apache-2.0 |
| JWT | PyJWT 2.15 | MIT |
| MIME po magic bytes | `filetype` | MIT |
| PDF | pdfplumber (+pdfminer.six), pypdf | MIT / BSD |
| DOCX | python-docx | MIT |
| XLSX | openpyxl | MIT |
| ODS | odfpy (wybieramy licencję Apache-2.0 z podwójnej) | Apache-2.0 / GPL – **w README zaznaczyć, że korzystamy z Apache** |
| DOC | LibreOffice headless (konwersja DOC→DOCX, osobny proces) | MPL-2.0 (słaby copyleft na poziomie pliku, bez linkowania). **Opisać w README.** |
| OCR | Tesseract + `tesseract-ocr-pol`, pytesseract | Apache-2.0 |
| JSONata | `jsonata-python` 0.7 (sprawdzanie i symulacja warunków SHOW) | Apache-2.0 |
| Lintery | rapidfuzz, networkx, rank-bm25 | MIT / BSD / Apache-2.0 |
| HTTP do Ollamy | httpx | BSD |
| LLM | Ollama (MIT) + **Qwen3 4B/8B Q4** (Apache-2.0) lub **Bielik 11B v2.x** (Apache-2.0, sprawdzić kartę modelu) | – |

**Nie używać:** PyMuPDF (AGPL), psycopg2 (LGPL), antiword (GPL), Llama (licencja niestandardowa).

Python: `python:3.14-slim-bookworm`, przypięty po digest. Jeśli któraś biblioteka nie ma jeszcze kół (wheels) dla 3.14, spadamy na 3.13 i opisujemy to w README. **Sprawdzić `pip install` do 17:00.**

---

## 3. Specyfikacja formatu COI (ściąga z materiałów)

- Klucze główne: `title` (do 255 znaków), `tabs[]`, `flow.links[]`.
- `tabs[].type` przyjmuje `MAIN` albo `FINISH`. Formularz ma **co najmniej 2 strony**, a ostatnia to `FINISH`.
- **Każde pole leży w sekcji** (`SECTION` lub `REPEATING_SECTION`), a dzieci sekcji są w `field.repeatingSectionGrid`. Sekcji nie wolno zagnieżdżać.
  - **Uwaga:** schemat ma literówkę `repetingSectionGrid`, a wzorce mają poprawne `repeatingSectionGrid`. **Emitujemy jak we wzorcach.**
- Siatka ma **3 kolumny** (we wzorcach `x + cols ≤ 3`). Pole zajmuje `cols: 3`, a sekcja ma `rows: 2, cols: 3`. `questionOrder` liczymy od 0 w obrębie rodzica.
- Każdy obiekt pola we wzorcach ma klucze `id` (UUID), `type`, `techName` (snake_case bez polskich znaków), `title`, `description`, `options`, `validation`, `readOnly`, `repeatingSectionGrid`, `states`, `questionOrder`, `tooltipMessage`. Klucze opcjonalne: `defaultValue`, `defaultValueType`, `dictionaryName`, `searchEnabled`, `multiLevelTree`, `consentSectionConfig`.
- Typy pól: `TEXT_FIELD`, `TEXTAREA`, `NUMBER`, `DATEPICKER`, `SELECT`, `RADIO`, `CHECKBOX`, `FILE_UPLOADER`, `TEXT_BLOCK`, `INFO_SECTION`, `CONSENT_SECTION`, `SECTION`, `REPEATING_SECTION`.
- Walidatory (tablica nazw): `REQUIRED`, `EMAIL`, `PESEL`, `NIP`, `REGON`, `ZIP_CODE`, `EPUAP`, `ADE`, `SERIAL_NUMBER_ID_CARD`.
- Opcje mają postać `{"id": "<tekst opcji>", "name": "<tekst opcji>", "techName": "<slug>"}`. We wzorcach `id` to tekst, nie UUID.
- Słowniki (nazwy z wzorców, nie z dokumentu): `Kraje`, `TERYT_DOWODOWY`, `TERYT_4G_DOWODOWY`. Dokument wymienia też: Województwo, Powiat, Gmina, Miejscowość, Numery kierunkowe. Słownik wolno podpiąć tylko do `SELECT`, `RADIO` i `CHECKBOX`, a wtedy `options: []`.
- Dane inicjalne: `readOnly: true`, `defaultValue: "MLPZ.name"`, `defaultValueType: "EXTERNAL_SYSTEM"`. Źródła to `PESEL`, `PESEL_ADDRESS` i `MLPZ`, z listą atrybutów w PDF „Dane inicjalne”. Na jedno pole przypada jedno źródło i jeden atrybut.
- Warunki wyświetlania zapisuje się w `states: [{"type": "SHOW"|"READ_ONLY", "query": "<JSONata>"}]`. Wzorzec zapytania:
  ```
  ("Tak" in tabs['<tytuł strony>' in title].questions['<techName sekcji>' in field.techName]
     .field.repeatingSectionGrid['<techName pola>' in field.techName].field.__userAnswer)
  ```
  Negacja to `$not( … )`. **Zapytanie odwołuje się do tytułu strony**, więc zmiana tytułu strony psuje warunki. Wyłapuje to linter grafu.
- `flow.links[]` ma postać `{id, source: tabId, target: tabId}` i tworzy liniowy łańcuch MAIN → … → FINISH. Strony alternatywne to dodatkowe linki.

---

## 4. API

Ścieżki **zgodne z `frontend/src/api/httpApi.ts`**, plus endpoint minimum.

| Metoda i ścieżka | Rola | Co robi | Priorytet |
|---|---|---|---|
| `POST /api/v1/convert` | official | **Minimum COI.** Multipart `file` → od razu JSON COI, bezstanowo. Opcja `?include=meta,flags` dokleja cytaty i flagi. | MUST |
| `GET /health` | – | Status API i dostępność Ollamy (`llm: up/down`) | MUST |
| `POST /auth/token` | – | Token JWT do demo (login z listy użytkowników, wyłączane w prod) | MUST |
| `GET /me?role=` | any | `User` | MUST |
| `POST /drafts` | official | Upload → pipeline → `{draftId}` | MUST |
| `GET /drafts` | official | `FormDraftSummary[]` (liczniki flag) | MUST |
| `GET /drafts/{id}` | official | `FormDraft` (model frontendu) | MUST |
| `PUT /drafts/{id}` | official | Zapis schematu → nowa wersja → automatyczny lint | MUST |
| `GET /drafts/{id}/coi` | official | **Czysty JSON COI do pobrania** | MUST |
| `POST /drafts/{id}/lint` | official | `LintFlag[]` | MUST |
| `PATCH /drafts/{id}/flags/{flagId}` | official | `fixed` albo `rejected` z uzasadnieniem → Audit | MUST |
| `POST /drafts/{id}/publish` | official | **409, gdy zostały nierozwiązane flagi `error`** | MUST |
| `GET /audit?draftId=` | official | `AuditEntry[]` | SHOULD |
| `GET /drafts/{id}/statute-chunks` | official | Fragmenty ustawy powiązane z polami | SHOULD |
| `GET /dictionaries`, `GET /dictionaries/{name}` | any | Słowniki COI + nasza propozycja (rozszerzenia I i II) | SHOULD |
| `POST /coi/import` | official | Wgranie gotowego JSON-a COI do edytora (round-trip, testy) | SHOULD |
| `GET /forms`, `GET /forms/{id}` | citizen | Opublikowane formularze | SHOULD |
| `GET /prefill?formId=` | citizen | Makieta MLPZ/PESEL (dane fikcyjne, **opisane jako makieta**) | SHOULD |
| `GET/POST/PUT /applications` | citizen | Wnioski obywatela, numer UPO | SHOULD |
| `GET /drafts/{id}/events` (SSE) | official | Etapy `upload → parse → ocr → generate → lint → done` dla `onProgress` | WOW |
| `POST /api/v1/convert/batch` | official | Wiele plików → ZIP z JSON-ami (rozszerzenie VI, „batch”) | WOW |

Błędy zwracamy jako `application/problem+json` (RFC 9457) z polskim komunikatem: 413 za duży plik, 415 zły typ, 422 zła nazwa pliku, 409 publikacja z flagami. OpenAPI jest pod `/docs` i stanowi „opis API” wymagany w README.

---

## 5. Pipeline krok po kroku

### [1] Walidacja uploadu (`app/uploads.py`)
- Rozszerzenie z listy dozwolonych **i** typ po magic bytes (`filetype`) **i** zgodność jednego z drugim. DOC i ODS rozpoznajemy po sygnaturach OLE/ZIP + `mimetype` w ODS.
- Nazwa pliku ma do 250 znaków i nie zawiera `; : > < / \ | ' * % $`. Sprawdzamy też znaki sterujące i `..`.
- `MAX_UPLOAD_MB` z env, czytamy strumieniowo i przerywamy po przekroczeniu. Do tego limit stron PDF (`MAX_PAGES`, np. 30) i limit rozpakowania ZIP dla DOCX/XLSX/ODS (ochrona przed zip bombą).
- **Plik żyje tylko w pamięci** (`BytesIO`). LibreOffice i Tesseract potrzebują pliku, więc dostają `tempfile` na `tmpfs` (`/tmp` w compose), usuwany w `finally`. W bazie zostają tylko `sha256` i nazwa.

### [2] Ekstrakcja → `DocumentIR`
Wspólna struktura: lista bloków `{page, kind: heading|label|checkbox|text|table_cell, text, level, bbox?}`.
- **PDF:** pdfplumber (słowa + pozycje). Gdy na stronie jest mniej niż ~50 znaków tekstu, renderujemy ją i robimy OCR. Wszystkie 9 przykładowych PDF-ów ma warstwę tekstu.
- **DOCX:** akapity, style nagłówków, tabele (formularze urzędowe to głównie tabele), znaki `☐ □ ` jako checkboxy.
- **XLSX/ODS:** komórki niepuste wierszami, scalone komórki jako nagłówki.
- **DOC:** LibreOffice → DOCX → jak wyżej.
- **JPG/PNG:** Tesseract `pol`, `--psm 4`, z poziomem pewności per słowo, który trafia potem do `meta.confidence`.
- Numeracja typu „2.1. Dane identyfikacyjne” wyznacza sekcje. Linie typu „podpis”, „data i podpis”, „wypełnia urząd” i instrukcje typu „WYPEŁNIJ WIELKIMI LITERAMI” są **odrzucane** (w e-usłudze ich nie ma).

### [3a] Heurystyki + katalog pól (`app/understand/field_catalog.yaml`)
Plik YAML, który **mogą uzupełniać myśliciele bez programowania**:
```yaml
- match: ["imię", "imie"]
  block: twoje_dane          # standardowy blok ze wzorca
- match: ["pesel"]
  type: TEXT_FIELD
  validation: [REQUIRED, PESEL]
  prefill: MLPZ.pesel
- match: ["nip"]
  type: TEXT_FIELD
  validation: [NIP]
- match: ["kod pocztowy"]
  block: adres
- match: ["data uiszczenia", "data "]
  type: DATEPICKER
- match: ["kwota", "zł"]
  type: NUMBER
- match: ["uzasadnienie", "opis", "uwagi"]
  type: TEXTAREA
- match: ["załącznik", "w załączeniu", "kopia"]
  type: FILE_UPLOADER
```
Dopasowanie robimy przez `rapidfuzz` z progiem, co jest odporne na błędy OCR. Rozpoznane grupy (imię + nazwisko + PESEL, adres, pełnomocnik, kontakt) zastępujemy **całym blokiem standardowym**. Czysty blok to też wynik lintera „prosty język”, bo teksty bloków pochodzą prosto ze standardów COI.

### [3b] LLM (`app/understand/llm.py`)
- Ollama `/api/chat` z parametrem `format` = **JSON Schema wyjścia** (structured outputs), `temperature: 0`, stały `seed`.
- Do modelu idzie tylko to, czego nie rozpoznały heurystyki, **sekcja po sekcji**. Formularz nr 9 ma 16 stron, więc całość nie mieści się w kontekście małego modelu.
- Model zwraca **mały model pośredni**, nie cały JSON COI: `[{label, plainTitle, type, required, options[], section, condition?, legalBasisHint?}]`. UUID, siatkę, JSONatę i flow zawsze robi kod.
- Timeout (np. 60 s na sekcję). Po timeoucie zostaje wynik heurystyk + flaga `info` „pole wymaga przeglądu” → **tryb bez LLM nadal zwraca poprawny JSON COI**.
- Do Audit (`aiOutputRef`) zapisujemy `model@digest + sha256(prompt)`, żeby było wiadomo, która wersja AI co wygenerowała.

### [4] Builder COI (`app/coi/builder.py`)
- Bloki standardowe trzymamy jako szablony JSON w `app/coi/blocks/` (wycięte z dwóch wzorców). Builder podmienia w nich UUID, nazwę urzędu i tytuły.
- Kolejność stron: Dane → Przedmiot wniosku (1..n) → Kontakt i zgody → FINISH. `flow.links` tworzy łańcuch.
- `techName` to slug bez polskich znaków, unikalny w formularzu (`_2`, `_3` przy kolizji).
- `visibleIf` z modelu pośredniego zamieniamy na `states[SHOW]` według wzorca z sekcji 3 (`app/coi/jsonata.py`).

### [5] Walidator reguł COI (`app/coi/validator.py`)
Pydantic v2 (modele COI, `extra="allow"`, żeby nie gubić nieznanych kluczy) + funkcje reguł z dokumentu „Reguły techniczne”: co najmniej 2 strony, ostatnia FINISH, każda strona ma pole, pole w sekcji, brak zagnieżdżonych sekcji, brak pól wejściowych na FINISH, słownik tylko w SELECT/RADIO/CHECKBOX, `options` puste przy słowniku, dane inicjalne ⇒ `readOnly`, tytuł do 255 znaków, `techName` obecny i unikalny, UUID poprawne.
**Pierwszy test do napisania:** oba wzorcowe JSON-y przechodzą walidator bez błędów.

---

## 6. Lintery

Kontrakt: `LintFlag` z `frontend/src/types/lint.ts`. ID flagi jest deterministyczne: `"<linter>:<techName>[:<reguła>]"`, więc decyzja urzędnika przetrwa ponowny lint.

| Linter | Jak | LLM? | Przykład flagi |
|---|---|---|---|
| `coi-rules` **(nowy)** | Walidator z kroku [5] | nie | „Strona końcowa zawiera pole TEXT_FIELD” – error |
| `static-graph` | networkx na `flow.links` (osiągalność FINISH, cykle, strony bez wejścia) + analiza zapytań JSONata: czy wskazany tytuł strony, `techName` sekcji i pola istnieją oraz czy wartość `"Tak"` jest wśród opcji pola. Symulacja w `jsonata-python`: czy pole jest pokazywane dla jakiejkolwiek odpowiedzi (martwe pole). | nie | „Warunek odwołuje się do strony ‘Dane osobowe’, której nie ma” – error |
| `exact-match` | `meta.legalBasis.quote` porównany z tekstem ustawy z korpusu po normalizacji (spacje, myślniki, cudzysłowy). `rapidfuzz.partial_ratio` ≥ 95 oznacza zgodność, 80–95 – ostrzeżenie (OCR/literówka), poniżej 80 – halucynacja. Jednostka redakcyjna (art./ust./pkt) pochodzi **z parsera ustawy**, nie z LLM. | nie | „Cytatu nie ma w ustawie” – error |
| `citation-relevance` | LLM: „czy ten fragment uzasadnia zbieranie pola X? tak/nie + 1 zdanie”. Wynik cache'owany po hashu (pole, cytat). | tak | warning |
| `gdpr` | Reguły: lista danych wrażliwych lub nadmiarowych (nr dowodu, nazwisko rodowe matki, stan cywilny, płeć, miejsce urodzenia…) bez `legalBasis` → flaga; dane dostępne z rejestru, a pytane ręcznie → sugestia prefill. Opcjonalnie LLM do uzasadnienia. | opcjonalnie | „Numer dowodu bez podstawy prawnej” – error |
| `wcag` (prosty język) | Reguły z rozdziału 1 „Standardów”: zdanie > 20 słów, słowa > 4 sylab, formy bezosobowe (`-no/-to`), lista zwrotów zakazanych (dokonać, posiadać, pragnąć, informujemy…), imiesłowy `-ąc`, pytanie złożone („i/oraz” + „?”), brak `title`, CAPS LOCK, SELECT z ≤ 5 opcjami (powinien być RADIO), RADIO z > 5 opcjami (powinien być SELECT). | nie | „Pytanie wielokrotnie złożone” – warning |

`coi-rules` wymaga dopisania jednej wartości do `LinterIdSchema` na froncie (sekcja 8). Bez tego da się wrzucić te flagi pod `static-graph`.

Trzy lintery są w pełni deterministyczne (`coi-rules`, `static-graph`, `exact-match`). To mocny argument na pitch: **„AI napisało, a kod sprawdził”**, a nie „AI sprawdziło AI”.

---

## 7. Dane, korpus prawny, bezpieczeństwo, Docker

**Korpus ustaw (`backend/data/statutes/`)** – myśliciele pobierają tekst jednolity z ISAP/ELI **przed** demo, jeden plik na akt. Wstępna lista do potwierdzenia:
- Ordynacja podatkowa (formularz 5 – nadpłata),
- ustawa o opłacie skarbowej (formularz 2),
- KPA, art. 217 i dalsze (formularz 3 – zaświadczenie),
- ustawa o drogach publicznych + rozporządzenie o zajęciu pasa (6),
- ustawa o ochronie zwierząt + rozporządzenie w sprawie ras psów agresywnych (7),
- ustawa o utrzymaniu czystości i porządku w gminach (8),
- Prawo geodezyjne i kartograficzne + rozporządzenie o numeracji porządkowej (1),
- ustawa o sporcie (9).

Parser dzieli tekst na art./ust./pkt (regex) i każdy fragment dostaje `chunkId` oraz `unit`. BM25 wybiera kandydatów, a LLM wskazuje dosłowny cytat.

**Baza (SQLite, `app/store/`)** – tabele `drafts`, `draft_versions` (JSON COI + meta, numer wersji), `flags`, `audit_log`, `published_forms`, `applications`. `audit_log` jest tylko do dopisywania, a każdy wpis zawiera `sha256(poprzedni_hash + treść)`. Ten **łańcuch hashy** wykrywa manipulację, kosztuje 10 linii kodu i dobrze wygląda na slajdzie.

**JWT** – HS256, sekret z `JWT_SECRET` albo z pliku `/run/secrets/jwt_secret`. Claimy `sub`, `role` (`official`/`citizen`), `exp`. Zależność FastAPI `require_role("official")`. Przełącznik `AUTH_ENABLED` na potrzeby demo.

**Konfiguracja (env, pydantic-settings):** `MAX_UPLOAD_MB`, `MAX_PAGES`, `ALLOWED_EXTENSIONS`, `JWT_SECRET`, `JWT_TTL_MIN`, `AUTH_ENABLED`, `OLLAMA_URL`, `LLM_MODEL`, `LLM_ENABLED`, `LLM_TIMEOUT_S`, `CORS_ORIGINS`, `DB_PATH`, `OCR_LANG=pol`.

**Docker Compose**
```
api     python:3.14-slim-bookworm@sha256:…   user 10001, read_only: true, tmpfs: /tmp, secrets: jwt_secret
        apt: tesseract-ocr tesseract-ocr-pol libreoffice-writer-nogui (warstwa osobno)
ollama  ollama/ollama:<wersja>                 wolumen na modele, profil "llm"
web     node:<wersja>-slim (Next.js build)    user node
```
- Bez `latest` i bez sekretów w obrazie. `HEALTHCHECK` na `/health`.
- Skrypt `scripts/pull_model.sh` pobiera model raz, przed demo, bo na obronie może nie być sieci.
- **Debian slim zamiast Alpine:** Tesseract, LibreOffice i koła Pythona (rapidfuzz, lxml) działają na glibc. Na musl trzeba by je kompilować, a obraz wcale nie byłby mniejszy. To uzasadnienie wpisać do README.
- Bez Ollamy (`LLM_ENABLED=false`) API działa w trybie heurystycznym. To zaleta przy ocenie kosztu wdrożenia: tańsza konfiguracja bez GPU.

---

## 8. Zmiany w kontrakcie z frontendem (do uzgodnienia z dev frontem do 18:00)

| Zmiana | Plik frontu | Po co |
|---|---|---|
| `Field.section?: {techName, title}` | `types/form.ts` | COI wymaga, by każde pole leżało w sekcji. Mapper grupuje kolejne pola po sekcji. |
| `Field.coi?: Record<string, unknown>` (nietknięte klucze COI) | `types/form.ts` | Bezstratny round-trip COI → front → COI |
| Nowe `FIELD_TYPES`: `fileUpload`, `textBlock`, `infoSection`, `consent`, `nip`, `regon` | `types/form.ts`, `FieldRenderer.tsx` | Typy obecne we wzorcach |
| `PrefillSource`: `PESEL`, `PESEL_ADDRESS`, `MLPZ` zamiast `mObywatel/CEIDG/KRS` | `types/form.ts`, mocki | Zgodność z „Danymi inicjalnymi” |
| `LinterIdSchema` + `"coi-rules"` | `types/lint.ts` | Nowy linter |
| Zakładka JSON pobiera `GET /drafts/{id}/coi` zamiast `toCoiJson` | `EditorView.tsx`, `httpApi.ts` | Jedno mapowanie, w backendzie |
| `uploadDocument` słucha SSE `/drafts/{id}/events` | `httpApi.ts` | Animowane etapy (WOW) |

Mapowanie typów (`app/mapping/frontend.py`): `text → TEXT_FIELD`, `textarea → TEXTAREA`, `number → NUMBER`, `date → DATEPICKER`, `select → SELECT`, `radio → RADIO`, `checkbox → CHECKBOX`, `pesel → TEXT_FIELD + [PESEL]`, `postalCode → TEXT_FIELD + [ZIP_CODE]`, `email → TEXT_FIELD + [EMAIL]`, `phone → TEXT_FIELD`, `required: true → "REQUIRED" w validation`, `visibleIf → states[SHOW]`, `legalBasis → meta` + krótka wersja w `tooltipMessage` („Pytamy, bo: art. … ”).

---

## 9. Pytania do organizatorów (Discord, dziś)

1. **Strona FINISH:** reguły mówią „wyłącznie `INFO_SECTION`”, a wzorce mają `SECTION` + `TEXT_BLOCK`. Którą wersję przyjmie importer? Domyślnie robimy jak we wzorcach.
2. **`validation`:** we wzorcach wszystkie tablice są puste, a reguły wymagają `REQUIRED`. Czy format to `["REQUIRED", "PESEL"]` (tablica stringów)? Domyślnie tak.
3. `repetingSectionGrid` (schemat) czy `repeatingSectionGrid` (wzorce)? Domyślnie robimy jak we wzorcach.
4. Pełne nazwy słowników (`Kraje`, `TERYT_DOWODOWY`, …) i czy są inne poza wymienionymi.
5. Godzina końcowa zgłoszeń i czy na obronie będzie dostęp do sieci (pobranie modelu).

---

## 10. Testy i metryka jakości

- `tests/test_validator.py` – oba wzorce przechodzą, a zepsute warianty (brak FINISH, pole poza sekcją, zły warunek) nie przechodzą.
- `tests/test_uploads.py` – nazwy z zakazanymi znakami, 251 znaków, PNG z rozszerzeniem `.pdf`, za duży plik, zip bomba.
- `tests/test_matrix.py` – **9 formularzy × wszystkie formaty** (ok. 70 plików z `data-pdf`): każdy daje JSON przechodzący walidator COI. To nasz test „nowych plików”.
- `tests/test_roundtrip.py` – wzorzec COI → model frontu → COI daje ten sam wynik (porównanie z pominięciem kolejności kluczy).
- `scripts/eval.py` – porównuje wynik dla formularzy 1 i 5 z wzorcowym JSON-em: recall etykiet pól (fuzzy), zgodność typów, zgodność walidatorów i słowników. **Daje liczbę na slajd**, np. „87% pól zgodnych ze wzorcem COI”.
- **Hold-out:** formularzy 8 i 9 (najdłuższe, 9 łączy 3 wnioski) **nie używamy do strojenia heurystyk**, tylko do sprawdzianu w nocy.
- `scripts/batch_convert.py` → `outputs/*.json`. To **„wynikowe pliki JSON”, wymagany element zgłoszenia.**

---

## 11. Struktura katalogów

```
backend/
  pyproject.toml          # uv, przypięte wersje
  Dockerfile  .dockerignore  README.md
  app/
    main.py  config.py  security.py  uploads.py  errors.py
    api/        convert.py drafts.py lint.py audit.py forms.py citizen.py meta.py events.py
    extract/    ir.py pdf.py docx.py sheet.py doc.py image.py
    understand/ pipeline.py heuristics.py field_catalog.yaml llm.py prompts/
    coi/        models.py builder.py jsonata.py validator.py layout.py blocks/*.json
    lint/       base.py coi_rules.py static_graph.py exact_match.py citation.py gdpr.py wcag.py
    legal/      parser.py index.py
    mapping/    frontend.py
    store/      db.py repo.py audit.py
  data/  statutes/*.txt  dictionaries/*.json  prefill_mock.json
  tests/  scripts/  
outputs/                  # wynikowe JSON-y do zgłoszenia
docker-compose.yml
docs/ARCHITEKTURA.md      # wymagana dokumentacja architektury (diagram z sekcji 1)
```

---

## 12. Harmonogram i podział pracy

| Kiedy | Dev backend | Dev frontend (pomaga backendowi) | Myśliciele (2) | Grafik / pitch |
|---|---|---|---|---|
| **do 17:30** | Szkielet FastAPI, `/health`, walidacja uploadu, modele Pydantic COI + walidator zielony na wzorcach. **`POST /api/v1/convert` zwraca na razie wzorzec**, czyli minimum „żyje”. | Uzgodnić kontrakt (sekcja 8), wysłać pytania z sekcji 9 | Rozpocząć `field_catalog.yaml` na podstawie formularzy 2, 3, 4 i „Standardów” | – |
| **do 20:00** | Ekstrakcja: PDF, DOCX, XLSX, ODS, DOC. Bloki standardowe wycięte ze wzorców. Builder + heurystyki, **pierwszy prawdziwy JSON dla formularzy 2, 3 i 4**. | SQLite + `/drafts*` zgodne z frontem, `mapping/frontend.py`, test round-trip | Pobrać teksty ustaw do `data/statutes/`. Lista danych wrażliwych dla RODO. Lista zwrotów zakazanych ze „Standardów”. | Diagram architektury do `docs/` |
| **do 23:00** | Ollama + model pośredni + prompty, test czasu odpowiedzi (**decyzja: Qwen3 4B czy 8B**). OCR JPG/PNG. | Lintery `coi-rules`, `static-graph` (JSONata), `exact-match`, `wcag`. Przełączyć front na `NEXT_PUBLIC_USE_MOCKS=false`. | Propozycja nowego słownika (rozszerzenie II) – **„Rasy psów uznawanych za agresywne”** z rozporządzenia (formularz 7) albo „Dyscypliny sportowe” (9): nazwa, struktura, użycie | Scenariusz filmu |
| **noc do 4:00** | `gdpr`, `citation-relevance`, parser ustaw + BM25, SSE, `/dictionaries`, `/prefill` (makieta) | `eval.py`, `test_matrix.py`, `batch_convert.py` → `outputs/` | Test na hold-oucie (8, 9) i na „obcych” plikach. Zgłaszać błędy do `field_catalog.yaml`. | Slajdy |
| **do 8:00 – zamrożenie** | Docker hardening (non-root, digest, secrets, tmpfs), README (budowanie, uruchomienie, konfiguracja, API), `docs/ARCHITEKTURA.md` | Poprawki z testów, demo end-to-end w Dockerze na czystej maszynie | Teksty do „Dlaczego pytamy?” | Nagranie filmu (≤ 3 min) |

**Zasada:** do 20:00 każdy etap kończy się działającym `POST /api/v1/convert`. Jeśli o 23:00 LLM jest za wolny, wyłączamy go (`LLM_ENABLED=false`), a demo idzie na heurystykach + linterach. To nadal pełne minimum.

---

## 13. Definicja ukończenia minimum (checklista przed zamrożeniem)

- [ ] `curl -F file=@formularz.pdf -H "Authorization: Bearer …" :8000/api/v1/convert` zwraca JSON przechodzący walidator COI dla **każdego** z 7 formatów
- [ ] Odrzucone: zły MIME, zła nazwa, za duży plik – z czytelnym komunikatem po polsku
- [ ] Pliki nie zostają na dysku (sprawdzić `/tmp` w kontenerze po teście)
- [ ] `docker compose up` na czystej maszynie, obrazy z przypiętymi wersjami, użytkownik inny niż root, sekret JWT podawany w runtime
- [ ] README: budowanie, uruchomienie, konfiguracja (tabela env), opis API (link do `/docs`), uzasadnienie Debian slim, licencje
- [ ] `docs/ARCHITEKTURA.md` z diagramem
- [ ] `outputs/` zawiera JSON-y dla wszystkich 9 formularzy
- [ ] Brak zależności GPL/AGPL (`pip-licenses` w CI lub ręcznie)

## 14. Ryzyka

| Ryzyko | Co robimy |
|---|---|
| Lokalny LLM wolny na laptopie | Mały model (Qwen3 4B Q4), LLM tylko dla nierozpoznanych pól i sekcja po sekcji, tryb bez LLM jako zapas |
| Nowe pliki na obronie, o innym układzie | Bloki standardowe + katalog fuzzy + test macierzy 9×7 + hold-out |
| Słaby OCR skanów | Pewność OCR w `meta` → flaga `info` przy niskiej pewności, urzędnik poprawia w edytorze |
| Niejasności formatu (sekcja 9) | Domyślnie robimy jak we wzorcach (to one przeszły import COI), decyzje opisane w README |
| LibreOffice duży (~400 MB) i MPL | Tylko `libreoffice-writer-nogui`. Jeśli zabraknie czasu, DOC obsługujemy przez konwersję w osobnym kontenerze lub opisujemy jako ograniczenie |
| Dwóch programistów | Front pomaga od 17:30, myśliciele robią YAML, korpus i listy reguł, czyli pracę bez kodu |
