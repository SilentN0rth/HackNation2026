# Panel urzędnika na Payload CMS – plan

Cel: `/official` przestaje być zestawem własnych stron i staje się panelem Payload CMS 3 osadzonym w `apps/web`
(Next.js 16). **Wszystkie dane urzędnika żyją w Payloadzie**, a **każdy element panelu jest zbudowany z komponentów
HeroUI v3** (`@heroui/react`) i animowany przez **motion.dev** (`motion/react`). Wygląd 1:1 ze stroną główną
(`src/features/HomeView.tsx`, tokeny w `src/styles.css`).

## Decyzje

| Temat | Decyzja |
| --- | --- |
| Dane | Payload + `@payloadcms/db-sqlite` (`apps/web/data/payload.db`). FastAPI zostaje silnikiem AI: ekstrakcja, generowanie schematu, lintery. Woła go Payload (hooki / endpointy). |
| UI | Wszystko na HeroUI: shell, logowanie, konto, dashboard, widoki list i edycji kolekcji, **pola** (własne komponenty `Field` dla każdego typu). Natywny CSS Payloada tylko jako fallback, przestylowany tokenami. |
| Animacje | `motion` (motion.dev). Krzywe i czasy z `styles.css` (`--ease-out` = `[0.23, 1, 0.32, 1]`), szanuj `prefers-reduced-motion` (`useReducedMotion`). |
| Ścieżka | `routes.admin = "/official"`, API Payloada pod `/api/payload` (żeby nie kolidować z `NEXT_PUBLIC_API_URL`). |
| Obywatel | Strona `/citizen` czyta opublikowane formularze i zapisuje wnioski przez Local/REST API Payloada (`src/api/payloadApi.ts`), mocki zostają dla `NEXT_PUBLIC_USE_MOCKS=true`. |
| Testy | `@playwright/test` w `apps/web/e2e`. Każdy etap kończy się zielonym `npm run e2e` + zrzutami ekranu w `apps/web/e2e/__screens__/`. |

## Struktura

```
apps/web/
  src/app/(frontend)/…          dotychczasowe strony (home, citizen) + layout z <Layout>
  src/app/(payload)/…           wygenerowane przez Payload: admin/[[...segments]], api/[...slug], layout.tsx, custom.css
  src/payload.config.ts         składa fragmenty poniżej – NIE edytuj poza etapem 0
  src/payload/
    collections/                Users, Media, Forms, AuditLog, Applications, StatuteChunks
    globals/                    Settings (preferencje panelu)
    hooks/                      wywołania FastAPI, wpisy do AuditLog
    admin/
      theme/                    tokens, custom.css, Providers (HeroUI + MotionConfig)   → agent B
      shell/                    Nav, Header, Logo, Icon, login, account, wylogowanie     → agent B
      collections/              List view, Edit view, kontrolki dokumentu, komórki       → agent C
      fields/                   komponenty pól HeroUI dla każdego typu                    → agent D
      views/                    Dashboard, Upload, FormEditor, AuditLog                   → agent E
      config/{theme,shell,collections,fields,views}.ts   fragmenty konfiguracji – każdy agent edytuje tylko swój
```

`payload.config.ts` importuje fragmenty z `admin/config/*.ts`, więc agenci nie edytują tego samego pliku.
`importMap.js` generuje się (`npm run payload:importmap`) **po scaleniu**, nie w gałęziach agentów.

## Kolekcje

- **users** (auth): name, initials, role (`official` | `admin`). Pierwszy użytkownik tworzony seedem.
- **media** (upload): wgrane blankiety (PDF/DOC/DOCX/ODS/XLSX/JPG/PNG), mime sprawdzany po zawartości.
- **forms**: title, status (`draft` | `in_review` | `published`), source → media, schema (json, `FormSchema`),
  lintFlags (json), coiJson (json, virtual/afterRead), publishedAt, version. Drafty Payloada włączone.
- **audit-log**: form → forms, user → users, action (`AuditAction`), details, aiOutputRef. Tylko odczyt w UI, tworzone hookami.
- **applications**: wnioski obywateli (form, status, values json, confirmationNo).
- **statute-chunks**: act, unit, text – podstawy prawne.
- global **settings**: preferencje panelu (gęstość, motyw jasny/ciemny, domyślny widok, animacje on/off).

## Etapy i agenci

0. **Fundament (agent A, sekwencyjnie)** – instalacja Payloada, route groups, kolekcje, seed z `src/mocks`,
   most do FastAPI, `payloadApi.ts` dla obywatela, Playwright + smoke testy, puste fragmenty `admin/config/*`.
   Commit na `main`.
1. **Równolegle (worktree każdy, gałąź `feat/payload-<x>`)**:
   - **B – Motyw i shell**: Providers, tokeny, Nav, Header, logo, login, create-first-user, account, preferencje (global settings), toasty, przejścia między widokami.
   - **C – Kolekcje**: własny widok listy (HeroUI Table, wyszukiwanie, filtry, paginacja, zaznaczanie, akcje masowe, puste stany), widok edycji (układ, sidebar, kontrolki zapisu/publikacji, wersje), komórki statusów.
   - **D – Pola**: komponenty `Field` na HeroUI dla text, textarea, email, number, date, select, radio, checkbox, relationship, upload, json, array, group/tabs + błędy walidacji.
   - **E – Widoki domenowe**: Dashboard (statystyki jak na stronie głównej), Upload z postępem SSE, edytor formularza (port `features/official/editor`), dziennik decyzji.
2. **Scalenie + QA (ja)** – merge gałęzi, `payload:importmap`, typecheck, lint, vitest, Playwright pełny + przegląd zrzutów.

## Reguły dla agentów

- Tylko HeroUI v3 (`@heroui/react`) do UI, tylko `motion/react` do animacji. Bez innych bibliotek UI.
- Tokeny i klasy z `src/styles.css` (ink/ink-2/ink-3, accent `#ca0049`, border, radius 6/10px, Inter, JetBrains Mono do numerów).
  Typografia nagłówków jak w HomeView: `font-semibold tracking-[-0.02em]`, separatory `border-t border-ink`, etykiety `text-sm font-semibold uppercase text-accent`.
- Teksty UI po polsku. Komentarze w kodzie w stylu repo (krótkie, po polsku).
- Każdy agent: `npm run typecheck`, `npm run lint`, `npm run e2e` (swoje testy w `e2e/<obszar>.spec.ts`), zrzuty ekranu desktop 1440 + mobile 390.
- Commity po angielsku, Conventional Commits, scope `web`, bez stopek atrybucji.

## Kontrakt fragmentów

Etap 0 zostawia `src/payload.config.ts`, kolekcje i hooki; agenci zmieniają panel wyłącznie przez swój fragment
w `src/payload/admin/config/`. Typy: `admin/config/types.ts`, sklejanie: `admin/config/merge.ts` (nie edytować).

**Shell (obszar B) jest pluginem, nie fragmentem:** `src/payload/plugins/admin-ui` (`plugins: [adminUiPlugin()]`
w `payload.config.ts`). Dokłada providers (MotionConfig, preferencje z globala `settings`), logo, `Nav` (poziomy pasek
jak na stronie publicznej, renderuje też `beforeNavLinks`/`afterNavLinks`), `logout.Button`, `avatar`, `admin.theme: "light"`
i widoki `login`, `createFirstUser`, `forgot`, `account`, `logout`, `inactivity`, `unauthorized`. Działa po sklejeniu
fragmentów i ustawia tylko to, czego fragmenty nie zdefiniowały. CSS: `plugins/admin-ui/theme/admin.css` (tokeny z `src/brand.css`).
Wspólne helpery dla C/D/E: `import { ease, transition, rise, primaryLink, heading, usePanelSettings } from "@/payload/plugins/admin-ui/theme"`.

| Plik | Właściciel | Co tam trafia |
| --- | --- | --- |
| `collections.ts` | C | `collections.<slug>.admin` – `components.views.list`/`edit`, `beforeList`, `components.edit.*`, `defaultColumns` |
| `fields.ts` | D | `fields.byType.<typ>` i `fields.byPath["<slug>.<pole>"]` – `{ Field, Cell, Label, Description, Error, … }` |
| `views.ts` | E | `components.views` (dashboard, własne widoki z `path`), `beforeDashboard`, `collections.forms.admin.components.views.edit.*`, `collections["audit-log"]` |

Każdy plik eksportuje `export const fragment: PanelFragment`:

```ts
type PanelFragment = {
  components?: AdminComponents;                                    // jak admin.components w Payloadzie
  admin?: AdminOptions;                                            // reszta admin (bez user/importMap/routes)
  collections?: Partial<Record<CollectionSlug, { admin?: CollectionConfig["admin"] }>>;
  globals?: Partial<Record<"settings" | "registry", { admin?: GlobalConfig["admin"] }>>;
  fields?: { byType?: Partial<Record<Field["type"], FieldComponents>>; byPath?: Record<string, FieldComponents> };
};
```

- Kolejność sklejania: collections → fields → views, potem plugin admin-ui. Tablice są sklejane, obiekty łączone
  rekurencyjnie (późniejszy fragment wygrywa), a komponent (`"ścieżka#Eksport"` albo `{ path, … }`) jest niepodzielny.
- Komponenty pól: `byPath` > komponenty zdefiniowane w kolekcji > `byType`; pola typu `ui` są pomijane.
- Ścieżki komponentów: `"@/payload/admin/<obszar>/Plik#Eksport"`. Pliki komponentów tylko we własnym katalogu
  (`admin/collections`, `admin/fields`, `admin/views`; shell w `plugins/admin-ui`).
- `importMap.js` regeneruje się po scaleniu (`npm run payload:importmap`). W gałęzi agenta wolno go wygenerować
  lokalnie do testów, ale nie commitować.
- Zaślepka `admin/views/HeroUIProbe.tsx` (w `views.ts` jako `beforeDashboard`) potwierdza, że HeroUI + Tailwind
  działają w panelu – agent E zastępuje ją dashboardem (test `e2e/smoke.spec.ts` trzeba wtedy dostosować).

### Dane i integracje (etap 0)

- Kolekcje: `users`, `media`, `forms` (wersje + drafty; pola AI: `aiStatus`, `aiError`, `fastapiDraftId`,
  `coiSource`; wirtualne `coiJson`), `audit-log` (zamknięta dla API, piszą hooki), `applications`, `statute-chunks`;
  globale `settings` (preferencje panelu) i `registry` (dane do prefillu obywatela).
- Hooki `src/payload/hooks/forms.ts`: nowy formularz z plikiem → FastAPI `POST /drafts` → `GET /drafts/{id}` →
  `POST /drafts/{id}/lint` → `GET /drafts/{id}/coi`. Przy awarii FastAPI formularz się zapisuje z `aiStatus: "error"`
  i komunikatem w `aiError`. Publikacja (`status: "published"`) wymaga obsłużenia krytycznych uwag, podbija `version`.
- Endpointy: `POST /api/payload/forms/:id/lint`, `POST /api/payload/forms/:id/generate` (ponowienie AI),
  `GET /api/payload/prefill?formId=`.
- Pomocniki e2e: `e2e/helpers.ts` – `login(page)`, `screenshot(page, testInfo, name)`, `trackConsoleErrors(page)`.
