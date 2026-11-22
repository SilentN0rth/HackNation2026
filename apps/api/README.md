# e-Formularze – backend

Usługa REST, która zamienia papierowy formularz urzędowy na konfigurację formularza elektronicznego w formacie JSON COI.
Przyjmuje pliki PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG i PNG. Działa w całości lokalnie, bez zewnętrznych API.

Python 3.14 · FastAPI · SQLite · Tesseract OCR · LibreOffice (konwersja DOC) · opcjonalnie lokalny model językowy przez Ollamę.

## Szybki start (Docker)

Z katalogu głównego repozytorium (tam leży `docker-compose.yml`):

```bash
./scripts/make-secrets.sh      # tworzy secrets/jwt_secret.txt i payload_secret.txt, istniejących nie nadpisuje
docker compose build
docker compose up -d
```

API działa pod adresem `http://localhost:8000`, a interaktywna dokumentacja pod `http://localhost:8000/docs`.

Z lokalnym modelem językowym (poprawia brzmienie etykiet pól):

```bash
LLM_ENABLED=true docker compose --profile llm up -d
docker compose exec ollama ollama pull qwen3:4b
```

Model pobierasz raz, przed pokazem. Bez modelu usługa działa w pełni na regułach i zwraca poprawny JSON.

### Pierwsze wywołanie

```bash
TOKEN=$(curl -s -X POST localhost:8000/auth/token \
  -H 'Content-Type: application/json' -d '{"userId":"u-urzednik"}' | jq -r .access_token)

curl -s -X POST localhost:8000/api/v1/convert \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Wniosek o zwrot opłaty skarbowej.pdf" > formularz.json
```

## Uruchomienie bez Dockera

Z katalogu `apps/api`:

```bash
python3.14 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Przy `AUTH_ENABLED=true` usługa nie wystartuje bez sekretu JWT (`JWT_SECRET` w `.env` albo plik wskazany w `JWT_SECRET_FILE`).
Celowo nie losujemy go przy starcie, bo wtedy tokeny przestawałyby działać po każdym restarcie i między workerami.

Do skanów potrzebny jest Tesseract z językiem polskim, a do plików DOC – LibreOffice (`soffice`).
Gdy ich brakuje, `/health` to pokaże: skany zwrócą błąd 503, a pliki DOC zostaną odczytane w trybie uproszczonym.

Testy i linter (te same polecenia uruchamia CI):

```bash
.venv/bin/python -m pytest
.venv/bin/ruff check app tests scripts
```

Pliki wynikowe dla wszystkich przykładowych formularzy z katalogu `data-pdf`:

```bash
.venv/bin/python scripts/batch_convert.py      # zapisuje do ../../outputs (katalog główny repozytorium)
```

## Konfiguracja

Wszystkie parametry podajesz w zmiennych środowiskowych (w Dockerze w `docker-compose.yml`, lokalnie w pliku `.env`).

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | `20` | Największy dopuszczalny rozmiar pliku |
| `MAX_PAGES` | `40` | Największa liczba stron PDF |
| `MAX_UNPACKED_MB` | `200` | Limit rozmiaru po rozpakowaniu DOCX, XLSX i ODS (ochrona przed „bombą ZIP”) |
| `AUTH_ENABLED` | `true` | Wymaganie tokenu JWT. `false` tylko do lokalnych testów z frontendem |
| `JWT_SECRET` | – | Sekret do podpisu tokenów. Przy `AUTH_ENABLED=true` wymagany on albo `JWT_SECRET_FILE` – inaczej start kończy się błędem |
| `JWT_SECRET_FILE` | `/run/secrets/jwt_secret` | Plik z sekretem (Docker secrets), używany, gdy `JWT_SECRET` jest pusty |
| `JWT_ALGORITHM` | `HS256` | Algorytm podpisu |
| `JWT_TTL_MIN` | `480` | Ważność tokenu w minutach |
| `JWT_ISSUER` | `e-formularze` | Wystawca tokenu (`iss`) |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Adresy frontendu (lista JSON) |
| `DB_PATH` | `data/app.db` | Plik bazy SQLite (wersje robocze, dziennik decyzji) |
| `OCR_LANG` | `pol` | Język Tesseracta |
| `TESSERACT_CMD` | `tesseract` | Polecenie Tesseracta |
| `SOFFICE_CMD` | `soffice` | Polecenie LibreOffice |
| `CONVERTER_TIMEOUT_S` | `90` | Limit czasu OCR i konwersji DOC |
| `LLM_ENABLED` | `false` | Włączenie lokalnego modelu językowego |
| `OLLAMA_URL` | `http://ollama:11434` | Adres Ollamy |
| `LLM_MODEL` | `qwen3:4b` | Model (licencja Apache-2.0) |
| `LLM_PROVIDER` | `ollama` | `ollama` (lokalnie) albo `edenai` (model przez Eden AI) |
| `EDENAI_API_KEY` | – | Klucz Eden AI, tylko ze zmiennej środowiskowej; bez niego model się nie włączy |
| `EDENAI_MODEL` | `mistral/mistral-small-2603` | Model w formacie `dostawca/model` |
| `LLM_TIMEOUT_S` | `60` | Limit czasu odpowiedzi modelu |
| `DEFAULT_ISSUER` | `Urząd Gminy` | Nazwa urzędu, gdy nie da się jej odczytać z pliku |

Sekret JWT nigdy nie trafia do obrazu. Podajesz go przy uruchomieniu kontenera przez Docker secrets albo zmienną środowiskową.

## REST API

Pełny opis z przykładami: `GET /docs` (OpenAPI). Błędy mają format `application/problem+json` (RFC 9457) i polskie komunikaty.

### Minimum z wyzwania

| Metoda i ścieżka | Opis |
| --- | --- |
| `POST /api/v1/convert` | Pole `file` (multipart) z jednym blankietem. Zwraca JSON COI. Opcjonalnie pole `issuer` (nazwa urzędu) i parametr `?include=meta,flags` – wtedy odpowiedź ma postać `{form, meta, flags}` |
| `POST /api/v1/convert/batch` | Pole `files` (do 20 plików). Zwraca archiwum ZIP z plikami JSON i raportem |

Walidacja pliku przed przetwarzaniem:

- rozszerzenie z listy dozwolonych i zgodność zawartości z rozszerzeniem po sygnaturze pliku (PDF, OLE2 dla DOC, ZIP z `word/`, `xl/` lub `mimetype` ODS, JPEG, PNG) – błąd 415,
- nazwa do 250 znaków, bez znaków `; : > < / \ | ' * % $` – błąd 422,
- rozmiar ponad `MAX_UPLOAD_MB` – błąd 413, odczyt przerywany w trakcie przesyłania.

Plik istnieje tylko w pamięci na czas żądania. LibreOffice i Tesseract dostają kopię w katalogu tymczasowym, usuwaną zaraz po konwersji. W bazie zostaje wyłącznie nazwa pliku i jego skrót SHA-256.

### Pozostałe ścieżki

| Metoda i ścieżka | Rola | Opis |
| --- | --- | --- |
| `GET /health` | – | Stan usługi, dostępność OCR, LibreOffice i modelu |
| `POST /auth/token` | – | Token dla konta demonstracyjnego: `u-urzednik` lub `u-obywatel` |
| `GET /me` | każda | Zalogowany użytkownik |
| `GET /dictionaries`, `GET /dictionaries/{nazwa}` | – | Słowniki COI i nasze propozycje nowych słowników |
| `POST /drafts` | urzędnik | Wgranie pliku i utworzenie wersji roboczej. Zwraca `{draftId}` |
| `GET /drafts` | urzędnik | Lista wersji roboczych z liczbą otwartych uwag |
| `GET /drafts/{id}` | urzędnik | Wersja robocza w modelu edytora |
| `PUT /drafts/{id}` | urzędnik | Zapis zmian z edytora (nowa wersja i ponowna kontrola jakości) |
| `GET /drafts/{id}/coi` | urzędnik | Czysty JSON COI (`?download=true` – jako plik) |
| `PUT /drafts/{id}/coi` | urzędnik | Podmiana całej konfiguracji JSON |
| `POST /coi/import` | urzędnik | Wgranie gotowego JSON COI do edytora |
| `POST /drafts/{id}/lint` | urzędnik | Ponowna kontrola jakości |
| `PATCH /drafts/{id}/flags/{flagId}` | urzędnik | Uwaga poprawiona albo odrzucona z uzasadnieniem |
| `POST /drafts/{id}/publish` | urzędnik | Publikacja. Błąd 409, gdy zostały nierozwiązane uwagi krytyczne |
| `GET /drafts/{id}/statute-chunks` | urzędnik | Przepisy, na które powołuje się formularz |
| `GET /audit?draftId=` | urzędnik | Dziennik decyzji |
| `GET /audit/verify` | urzędnik | Sprawdzenie, czy nikt nie zmienił wpisów w dzienniku |
| `GET /forms`, `GET /forms/{id}` | każda | Opublikowane e-usługi |
| `GET /prefill?formId=` | obywatel | Dane inicjalne (dane demonstracyjne) |
| `GET /applications`, `GET /applications/{id}` | obywatel | Wnioski obywatela |
| `POST /applications`, `PUT /applications/{id}` | obywatel | Zapis szkicu albo wysłanie wniosku (numer UPO) |

## Architektura

```
plik ─► walidacja (nazwa, rozmiar, sygnatura) ─► ekstrakcja tekstu ─► rozpoznanie pól ─► budowa JSON COI ─► kontrola jakości
         uploads.py                               extract/            understand/         coi/builder.py      lint/
```

1. **Ekstrakcja** (`app/extract`) sprowadza każdy format do listy linii z numerem strony. PDF czyta `pdfplumber`, a strony bez warstwy tekstu idą do OCR. DOCX czyta `python-docx` razem z polami tekstowymi i tabelami. XLSX czyta `openpyxl`, ODS – `odfpy`. DOC jest konwertowany przez LibreOffice do DOCX. Skany przechodzą przez Tesseract.
2. **Rozpoznanie pól** (`app/understand`) działa na regułach z pliku `catalog.yaml`, który można rozbudowywać bez programowania. Reguły rozpoznają:
   - sekcje po numeracji („2.1.”, „IV.”, „A.”) i nagłówkach,
   - pola wyboru po znakach kratek oraz listach „1)”, „2)”,
   - zależności („Jeśli wybierzesz tę formę, wpisz…” zamienia się w warunek pokazania pola),
   - pola ukryte w zdaniach („w miejscowości … przy ulicy …”),
   - typy i walidacje (data, kwota, PESEL, NIP, REGON, kod pocztowy, e-mail),
   - słowniki,
   - części do pominięcia: instrukcje, klauzule RODO, podpisy, pola „wypełnia urząd”.
3. **Budowa JSON COI** (`app/coi/builder.py`) korzysta z bloków standardowych wyciętych ze wzorcowego pliku COI: strona „Dane” (urząd, podmiot wniosku, dane z MLPZ/PESEL, adres ze słownikami), „Kontakt i zgody” oraz strona końcowa. Rozpoznane pola trafiają na strony tematyczne między nimi, do 12 pól na stronę. Kod nadaje identyfikatory UUID, nazwy techniczne, siatkę, kolejność pytań, przejścia między stronami i zapytania JSONata dla warunków.
4. **Kontrola jakości** (`app/lint`) daje uwagi w trzech stopniach (krytyczna, do sprawdzenia, sugestia):
   - zgodność z regułami technicznymi COI,
   - graf przejść i poprawność warunków (czy wskazane pole i odpowiedź istnieją, czy pole warunkujące jest wcześniej),
   - minimalizacja danych zgodnie z RODO,
   - prosty język i dostępność,
   - podpowiedzi słowników.
5. **Model językowy** (opcjonalnie, `app/understand/llm.py`) tylko poprawia brzmienie etykiet. Strukturę zawsze buduje kod, więc wynik jest powtarzalny, a usługa działa także bez modelu.
6. **Baza** (`app/store`) to SQLite. Trzyma wersje robocze, decyzje w sprawie uwag, opublikowane e-usługi i wnioski. Każdy wpis dziennika decyzji zawiera skrót SHA-256 poprzedniego wpisu, więc zmiana historii jest wykrywalna (`/audit/verify`).

Edytor we frontendzie pracuje na uproszczonym modelu pól. `app/mapping/frontend.py` tłumaczy go w obie strony i zachowuje wszystkie klucze COI, których edytor nie zna. Testy sprawdzają, że wzorcowe pliki wracają bez żadnej zmiany.

### Słowniki i dane inicjalne

Pola adresowe i dane osobowe na stronie „Dane” mają podpięte słowniki (`Kraje`, `TERYT_DOWODOWY`, `TERYT_4G_DOWODOWY`) i dane inicjalne (`PESEL.*`, `MLPZ.*`) tak jak we wzorcach COI.
Proponujemy dwa nowe słowniki (`GET /dictionaries`):

- `RASY_PSOW_UZNAWANYCH_ZA_AGRESYWNE` – 11 ras z rozporządzenia MSWiA z 28 kwietnia 2003 r., do wniosku o zezwolenie na utrzymywanie psa,
- `DYSCYPLINY_SPORTOWE` – do wniosków o stypendia i nagrody sportowe.

### Decyzje projektowe

- **Format jak we wzorcach.** Tam, gdzie schemat różni się od wzorcowych plików (`repetingSectionGrid` i `repeatingSectionGrid`), stosujemy zapis ze wzorców.
- **DOCX z rozszerzeniem `.doc`** jest przyjmowany, bo wymagania łączą oba rozszerzenia w jedną kategorię „DOC”.
- **Obraz Dockera** bazuje na oficjalnym `python:3.14.9-alpine3.24`. Proces działa jako użytkownik `app` (UID 10001) bez uprawnień administratora, w kontenerze z systemem plików tylko do odczytu. Na zewnątrz wystawiony jest wyłącznie port 8000. Ollama nie wystawia portu.
  Alpine wybraliśmy, bo daje najmniejszy obraz z najmniejszą liczbą pakietów (mniejsza powierzchnia ataku i mniej zgłoszeń CVE), a Tesseract z danymi dla języka polskiego i LibreOffice Writer są dostępne wprost z `apk`.

## Stan realizacji względem BACKEND_PLAN.md

Zrobione:

- pipeline `uploads → extract → understand → coi/builder → coi/validator → lint → store` dla wszystkich formatów z wyzwania (PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG, PNG), z OCR i opcjonalnym LLM przez Ollamę,
- `POST /api/v1/convert` i `/convert/batch`, pełny cykl wersji roboczej (`/drafts*`, publikacja, dziennik decyzji z łańcuchem SHA-256), ścieżki obywatela (`/forms`, `/prefill`, `/applications`), `/dictionaries`,
- lintery: reguły COI i graf przejść (`static_graph.py`, reguły COI są w nim wywoływane przez `coi/validator.py`), `gdpr`, `wcag`, podpowiedzi słowników (`lint/dictionaries.py`, raportowane pod identyfikatorem `citation-relevance`),
- JWT z rolami `official` i `citizen`, błędy RFC 9457, obraz Dockera bez uprawnień administratora.

Poza zakresem (świadomie odłożone):

- lintery `exact-match` (cytat podstawy prawnej porównany z tekstem ustawy) i `citation-relevance` w wersji z planu (ocena przez LLM, czy przepis uzasadnia pole) – nazwa `citation-relevance` jest dziś zajęta przez podpowiedzi słowników,
- parser ustaw `legal/` z indeksem BM25 i korpus `data/statutes/` – dlatego `GET /drafts/{id}/statute-chunks` tylko odsyła podstawy prawne odczytane z formularza (`legalBasis`), bez tekstu przepisu,
- strumień postępu SSE `GET /drafts/{id}/events` – frontend pokazuje etapy bez zdarzeń z serwera,
- `pyproject.toml` i `uv` – zależności są przypięte w `requirements.txt` i `requirements-dev.txt`.

## Licencje zależności

Wszystkie zależności są open source i nie wymagają udostępniania kodu (bez GPL i AGPL):

- FastAPI, Uvicorn, Pydantic, PyJWT, pdfplumber, python-docx, openpyxl, Pillow, RapidFuzz, PyYAML, httpx, NetworkX – licencje MIT, BSD lub Apache-2.0,
- odfpy – podwójna licencja, korzystamy z Apache-2.0,
- Tesseract i pytesseract – Apache-2.0,
- Ollama – MIT, a model Qwen3 – Apache-2.0,
- LibreOffice (MPL-2.0) działa jako osobny program wywoływany z linii poleceń, bez łączenia z naszym kodem.

Aktualną listę licencji zainstalowanych pakietów wypisze `pip-licenses` (jest w `requirements-dev.txt`):

```bash
.venv/bin/pip-licenses --from=mixed --order=license --format=markdown
```
