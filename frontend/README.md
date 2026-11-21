# e-Formularze – frontend (HackNation 2026, COI)

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · HeroUI v3 (React Aria – WCAG) · Zod 4.

## Start

```bash
npm install
cp .env.example .env.local   # domyślnie NEXT_PUBLIC_USE_MOCKS=true
npm run dev                  # http://localhost:3000
```

Przełącznik „Urzędnik / Obywatel” w prawym górnym rogu (rola wynika z adresu: `/official/*`, `/citizen/*`).

## Gdzie co jest

```
src/
  app/                 trasy (cienkie server components → widoki z features/)
    official/          lista, upload, drafts/[id] (edytor + panel lintera), audit
    citizen/           usługi, applications, form/[id]?app=…
  features/            widoki klienckie ("use client") – cała logika ekranów
  components/          AppHeader, FieldRenderer, FlagCard, Dropzone, Feedback
  types/               schematy Zod = jedyne źródło typów (z.infer)
  api/
    types.ts           kontrakt frontend ↔ backend
    mockApi.ts         implementacja na mockach (stan w pamięci przeglądarki)
    httpApi.ts         FastAPI – każda odpowiedź walidowana schematem Zod
    adapters.ts        mapowanie na format JSON COI (TODO)
  lib/validators.ts    walidacja Zod: pola obywatela (PESEL, kod, tel., e-mail…), plik, uzasadnienie flagi
  mocks/               WSZYSTKIE dane testowe – tu poprawiacie demo
  app/globals.css      tokeny kolorów (nadpisują motyw HeroUI, kontrast WCAG AA)
```

Plan pracy i scenariusz demo: `PLAN.md` w oryginalnym szkielecie (bez zmian merytorycznych).
