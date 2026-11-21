# e-Formularze – frontend (HackNation 2026, COI)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · HeroUI v3 (React Aria, WCAG) · Zod 4 · PWA.
Backend: Python (FastAPI) w katalogu `apps/api/`.

## Start

```bash
npm install
cp .env.example .env.local
npm run payload:seed         # baza Payloada (data/payload.db) z danymi demo
npm run dev                  # http://localhost:5173, panel urzędnika: /official
```

Logowanie do panelu: `urzednik@example.gov.pl` / `demo1234` (hasło z `SEED_PASSWORD`).

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | serwer deweloperski z podglądem na żywo |
| `npm run build` | sprawdzenie typów i build produkcyjny do `.next/` (w Dockerze tryb `standalone`) |
| `npm run start` | uruchomienie buildu produkcyjnego na :5173 |
| `npm run typecheck` | generowanie typów tras i `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | testy jednostkowe Vitest (`src/**/*.test.ts`: walidatory, linter, warunki widoczności) |
| `npm run e2e` | Playwright (`e2e/`, desktop 1440 + mobile 390, zrzuty w `e2e/__screens__/`); sam uruchamia `next dev` i seed |
| `npm run payload:seed` | idempotentny seed Payloada z `src/mocks` |
| `npm run payload:importmap` | regeneracja `src/app/(payload)/official/importMap.js` po dodaniu komponentów panelu |
| `npm run payload:types` | regeneracja `src/payload-types.ts` po zmianie kolekcji |

Przełącznik „Urzędnik / Obywatel” w prawym górnym rogu. `/citizen/*` to strona obywatela, `/official` – panel
Payload CMS 3 (dane urzędnika w SQLite, plan: `docs/PAYLOAD_PLAN.md`).

## Konfiguracja

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | `false` – REST Payloada (`/api/payload`, `src/api/payloadApi.ts`), `true` – dane demonstracyjne z `src/mocks` bez backendu |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | adres backendu |
| `PAYLOAD_SECRET` | tylko dev: stały fallback | sekret Payloada (JWT, szyfrowanie); w produkcji wymagany |
| `FASTAPI_URL` | `http://localhost:8000` | silnik AI wołany przez hooki Payloada po stronie serwera |
| `SEED_PASSWORD` | `demo1234` (dev) | hasło konta z seeda |
| `DATABASE_URL` | `file:data/payload.db` | baza SQLite Payloada |
| `BUILD_ID` | czas buildu | wersja cache service workera; `next.config.ts` przekazuje ją jako `NEXT_PUBLIC_BUILD_ID` |

Zmienne `NEXT_PUBLIC_*` są wkompilowywane w bundle podczas `npm run build` (w Dockerze jako `ARG`).
Przy `NEXT_PUBLIC_USE_MOCKS=false` makiety z `src/mocks` nie trafiają do paczki klienta – `mockApi` jest
ładowane leniwie (`import()`) tylko w trybie demonstracyjnym.

Frontend sam pobiera token JWT dla roli urzędnika i obywatela (`POST /auth/token`), więc backend może działać z włączonym uwierzytelnianiem.

## Struktura

```
src/
  app/(frontend)/      strony publiczne (home, citizen) + layout z <Layout>
  app/(payload)/       panel Payloada (/official) i REST (/api/payload) – szablon Payloada
  payload.config.ts    konfiguracja Payloada, składa fragmenty z payload/admin/config
  payload/             kolekcje, globale, hooki (FastAPI, dziennik), endpointy, seed, admin/* (UI panelu)
  styles.css           tokeny kolorów, typografia, ruch
  components/          Layout (komponent serwerowy) + HeaderNav (wyspy klienckie: nawigacja,
                       przełącznik roli, nazwa użytkownika), ServiceWorker, Feedback, Dropzone,
                       FieldRenderer, FlagCard
  features/            ekrany: HomeView, official/*, citizen/*
    official/editor/   części edytora: FieldEditor, StructureNav, LintPanel, CoiJsonPanel
    citizen/fill/      kreator wniosku: useWizard (stan), ConsentPhase, StepForm, SummaryCard,
                       SubmittedPhase, WizardProgress
  types/               schematy Zod, jedyne źródło typów
  api/                 kontrakt (types.ts), payloadApi.ts, mockApi.ts, httpApi.ts (FastAPI wprost)
  lib/                 walidacja, warunki widoczności, linter, useAsync, format (daty, błędy); testy *.test.ts
  mocks/               dane demonstracyjne
```

## PWA

- Manifest: `src/app/manifest.ts` → `/manifest.webmanifest` (ikony w `public/icons/`, w tym maskowalne).
- Service worker: `public/sw.js`, rejestrowany tylko w buildzie produkcyjnym jako `/sw.js?v=<id buildu>`.
  Nazwa cache pochodzi z parametru `v`, więc każdy build zaczyna od czystego cache, a stary jest usuwany.
  Statyczne zasoby z cache, nawigacje sieć-najpierw z fallbackiem `public/offline.html`. Zapytania do API
  nie są cache'owane.
- Instalację sprawdzisz po `npm run build && npm run start` (DevTools → Application → Manifest).

## Wygląd

Styl inspirowany serwisem coi.gov.pl: biel, czerń `#0d0e0e`, akcent `#ca0049`, krój Inter.
Animacje tylko tam, gdzie pomagają (wejście treści, potwierdzenie kliknięcia), krzywe `ease-out`,
czas poniżej 300 ms, pełne wsparcie `prefers-reduced-motion`.
