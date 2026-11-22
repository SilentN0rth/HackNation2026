# e-Formularze – HackNation 2026, wyzwanie COI

**Prezentacja:** [docs/prezentacja.pdf](docs/prezentacja.pdf) · **Film:** [docs/film.mp4](docs/film.mp4) · **Demo:** https://e-formularze.up.railway.app

Zamiana papierowych formularzy urzędowych na formularze elektroniczne w formacie JSON COI. Urzędnik wgrywa blankiet,
poprawia wynik w edytorze i publikuje e-usługę, a obywatel wypełnia ją krok po kroku.

**Wersja demonstracyjna:** [web-production-e354412c.up.railway.app](https://web-production-e354412c.up.railway.app) –
panel urzędnika pod `/official`, przycisk „Zaloguj jako urzędnik (demo)” na stronie logowania.

## Co potrafi

- **Każdy format z wyzwania** – PDF, DOC, DOCX, ODS, XLSX oraz skany (JPG, PNG, OCR Tesseract). Z każdego formatu
  powstaje ta sama struktura: pola wyboru z kwadracików (☐) w PDF, punktorów Worda i obramowanych komórek arkusza.
- **Logika formularza** – pola i sekcje warunkowe (np. dane klubu tylko dla wnioskodawcy „Klub sportowy”), formularze
  łączące kilka wniosków z pytaniem o rodzaj wniosku, zgody, załączniki, słowniki (TERYT, kraje, dyscypliny).
- **Zgodność ze standardem COI** – bloki standardowe (adresat, podmiot wniosku, pełnomocnictwo, opłata skarbowa,
  kontakt, zgody), walidator reguł technicznych i kontrola jakości: RODO, prosty język, dostępność.
- **Edytor urzędnika** – podgląd tego, co zobaczy obywatel, uwagi do rozpatrzenia przed publikacją, dziennik decyzji.
- **Model językowy (opcjonalnie)** – poprawia tylko brzmienie etykiet; strukturę zawsze buduje kod, więc wynik jest
  powtarzalny. Zawsze model otwarty: lokalnie przez Ollamę albo przez Eden AI (`LLM_PROVIDER=edenai`, klucz w `EDENAI_API_KEY`), co mentor COI potwierdził jako zgodne z regulaminem.

## Struktura repozytorium

| Katalog | Zawartość |
| --- | --- |
| `apps/api/` | Usługa REST (Python 3.14, FastAPI): `POST /api/v1/convert` i edytor wersji roboczych. Instrukcja w `apps/api/README.md` |
| `apps/web/` | Aplikacja dla urzędnika i e-usługa dla obywatela (Next.js 16, Payload CMS 3, HeroUI, Tailwind, Zod, PWA). Instrukcja w `apps/web/README.md` |
| `packages/brand/` | Logo i ikony |
| `docs/` | Architektura (`ARCHITEKTURA.md`), wdrożenie na Railway (`DEPLOY_RAILWAY.md`) |
| `outputs/` | Wynikowe pliki JSON dla 9 formularzy z wyzwania i raport |
| `data-pdf/` | Materiały i przykładowe formularze od organizatorów |

## Uruchomienie

```bash
./scripts/make-secrets.sh        # tworzy secrets/jwt_secret.txt i secrets/payload_secret.txt
docker compose up -d --build
```

| Adres | Co tam jest |
| --- | --- |
| `http://localhost:5173` | Aplikacja: urzędnik wgrywa formularz, poprawia go w edytorze i publikuje, obywatel wypełnia e-usługę |
| `http://localhost:5173/official` | Panel urzędnika, konto `urzednik@example.gov.pl`, hasło z `SEED_PASSWORD` (domyślnie `demo1234`) |
| `http://localhost:8000` | REST API, minimum z wyzwania: `POST /api/v1/convert` |
| `http://localhost:8000/docs` | Opis API (OpenAPI) |

Najważniejsze zmienne (plik `.env` obok `docker-compose.yml`):

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `PUBLIC_API_URL` | `http://localhost:8000` | Adres API wkompilowany we frontend (argument budowania obrazu `web`) |
| `SEED_PASSWORD` | `demo1234` | Hasło konta demo; na serwerze publicznym ustaw własne |
| `PAYLOAD_SEED` | `true` | `false` – czysta instalacja bez danych demo |
| `DEMO_LOGIN` | `false` | `true` – przycisk logowania na konto urzędnika bez uprawnień administratora |
| `LLM_ENABLED`, `LLM_PROVIDER` | `false`, `ollama` | Model językowy do etykiet: `ollama` (profil `llm` w compose) albo `edenai` |
| `EDENAI_API_KEY` | – | Klucz Eden AI; trzymaj go tylko w `.env` lub w zmiennych hostingu |

Baza i wgrane pliki są w wolumenach `web-data` i `api-data`.

### Bez Dockera

Wymaga Node 24 i [uv](https://docs.astral.sh/uv/).

```bash
npm run setup                                  # zależności web + venv Pythona 3.14 dla api
cp apps/web/.env.example apps/web/.env.local
npm run dev                                    # web :5173 i api :8000 naraz
```

Frontend bez backendu: `NEXT_PUBLIC_USE_MOCKS=true` w `apps/web/.env.local` (dane demonstracyjne).

## Testy i kontrola jakości

| Polecenie (z katalogu głównego) | Co robi |
| --- | --- |
| `npm run dev` | web i api z przeładowaniem na żywo |
| `npm run lint` | ESLint (web) i Ruff (api) |
| `npm run typecheck` | TypeScript (web) |
| `npm test` | Vitest (web) i pytest (api) |
| `npm run check:outputs` | Reguły COI i jakość dla plików w `outputs/` |
| `npm --prefix apps/web run e2e` | Playwright (desktop i mobile); scenariusze z wizualizacji organizatorów wymagają działającego api |
| `npm run build` | build produkcyjny web |

CI (`.github/workflows/ci.yml`) uruchamia te same kroki oraz `docker compose build`.

## Wdrożenie

Oba obrazy działają na dowolnym hostingu kontenerów. Instrukcja dla Railway – usługi, zmienne, wolumeny i
pułapki (port, IPv6, `VOLUME`) – jest w [`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md).
