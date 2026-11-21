# e-Formularze – frontend (HackNation 2026, COI)

React 19 · Vite · TypeScript · Tailwind CSS v4 · HeroUI v3 (React Aria, WCAG) · React Router · Zod 4.

## Start

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:5173
```

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | serwer deweloperski z podglądem na żywo |
| `npm run build` | sprawdzenie typów i build produkcyjny do `dist/` |
| `npm run preview` | podgląd buildu produkcyjnego |
| `npm run lint` | ESLint |

Przełącznik „Urzędnik / Obywatel” w prawym górnym rogu. Rola wynika z adresu: `/official/*`, `/citizen/*`.

## Konfiguracja

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `VITE_USE_MOCKS` | `false` | `false` – prawdziwe API z katalogu `backend/`, `true` – dane demonstracyjne z `src/mocks` bez backendu |
| `VITE_API_URL` | `http://localhost:8000` | adres backendu |

Frontend sam pobiera token JWT dla roli urzędnika i obywatela (`POST /auth/token`), więc backend może działać z włączonym uwierzytelnianiem.

## Struktura

```
src/
  main.tsx             wejście aplikacji
  router.tsx           trasy
  styles.css           tokeny kolorów, typografia, ruch
  components/          Layout, Feedback, Dropzone, FieldRenderer, FlagCard
  features/            ekrany: HomeView, official/*, citizen/*
  types/               schematy Zod, jedyne źródło typów
  api/                 kontrakt (types.ts), mockApi.ts, httpApi.ts
  lib/                 walidacja, warunki widoczności, useAsync
  mocks/               dane demonstracyjne
```

## Wygląd

Styl inspirowany serwisem coi.gov.pl: biel, czerń `#0d0e0e`, akcent `#ca0049`, krój Inter.
Animacje tylko tam, gdzie pomagają (wejście treści, potwierdzenie kliknięcia), krzywe `ease-out`,
czas poniżej 300 ms, pełne wsparcie `prefers-reduced-motion`.
