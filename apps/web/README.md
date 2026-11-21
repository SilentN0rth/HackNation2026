# e-Formularze – frontend (HackNation 2026, COI)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · HeroUI v3 (React Aria, WCAG) · Zod 4 · PWA.
Backend: Python (FastAPI) w katalogu `apps/api/`.

## Start

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:5173
```

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | serwer deweloperski z podglądem na żywo |
| `npm run build` | sprawdzenie typów i build produkcyjny do `.next/` (w Dockerze tryb `standalone`) |
| `npm run start` | uruchomienie buildu produkcyjnego na :5173 |
| `npm run typecheck` | generowanie typów tras i `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-next`) |

Przełącznik „Urzędnik / Obywatel” w prawym górnym rogu. Rola wynika z adresu: `/official/*`, `/citizen/*`.

## Konfiguracja

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | `false` – prawdziwe API z katalogu `apps/api/`, `true` – dane demonstracyjne z `src/mocks` bez backendu |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | adres backendu |

Zmienne `NEXT_PUBLIC_*` są wkompilowywane w bundle podczas `npm run build` (w Dockerze jako `ARG`).

Frontend sam pobiera token JWT dla roli urzędnika i obywatela (`POST /auth/token`), więc backend może działać z włączonym uwierzytelnianiem.

## Struktura

```
src/
  app/                 trasy Next.js (App Router), layout, manifest PWA
  styles.css           tokeny kolorów, typografia, ruch
  components/          Layout, ServiceWorker, Feedback, Dropzone, FieldRenderer, FlagCard
  features/            ekrany: HomeView, official/*, citizen/*
  types/               schematy Zod, jedyne źródło typów
  api/                 kontrakt (types.ts), mockApi.ts, httpApi.ts
  lib/                 walidacja, warunki widoczności, useAsync
  mocks/               dane demonstracyjne
```

## PWA

- Manifest: `src/app/manifest.ts` → `/manifest.webmanifest` (ikony w `public/icons/`, w tym maskowalne).
- Service worker: `public/sw.js`, rejestrowany tylko w buildzie produkcyjnym. Statyczne zasoby
  z cache, nawigacje sieć-najpierw z fallbackiem `public/offline.html`. Zapytania do API nie są cache'owane.
- Instalację sprawdzisz po `npm run build && npm run start` (DevTools → Application → Manifest).

## Wygląd

Styl inspirowany serwisem coi.gov.pl: biel, czerń `#0d0e0e`, akcent `#ca0049`, krój Inter.
Animacje tylko tam, gdzie pomagają (wejście treści, potwierdzenie kliknięcia), krzywe `ease-out`,
czas poniżej 300 ms, pełne wsparcie `prefers-reduced-motion`.
