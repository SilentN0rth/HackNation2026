# e-Formularze – HackNation 2026, wyzwanie COI

Zamiana papierowych formularzy urzędowych na formularze elektroniczne w formacie JSON COI.

Monorepo:

| Katalog | Zawartość |
| --- | --- |
| `apps/api/` | Usługa REST (Python 3.14, FastAPI): `POST /api/v1/convert` i edytor wersji roboczych. Instrukcja w `apps/api/README.md` |
| `apps/web/` | Aplikacja dla urzędnika i e-usługa dla obywatela (Next.js 16, HeroUI, Tailwind, Zod, PWA). Instrukcja w `apps/web/README.md` |
| `packages/brand/` | Logo, ikony i generator znaku |
| `docs/` | Architektura (`docs/ARCHITEKTURA.md`) |
| `outputs/` | Wynikowe pliki JSON dla formularzy z wyzwania i raport |
| `data-pdf/` | Materiały i przykładowe formularze od organizatorów |

## Uruchomienie

```bash
./scripts/make-secrets.sh        # tworzy secrets/jwt_secret.txt (bez niego API nie wystartuje)
docker compose up -d --build
```

Adres API wkompilowany we frontend ustawisz zmienną `PUBLIC_API_URL` (argument budowania obrazu `web`).

| Adres | Co tam jest |
| --- | --- |
| `http://localhost:5173` | Aplikacja: urzędnik wgrywa formularz, poprawia go w edytorze i publikuje, obywatel wypełnia e-usługę |
| `http://localhost:8000` | REST API, minimum z wyzwania: `POST /api/v1/convert` |
| `http://localhost:8000/docs` | Opis API (OpenAPI) |

Bez Dockera (wymaga Node 24 i [uv](https://docs.astral.sh/uv/)):

```bash
npm run setup                                  # zależności web + venv Pythona 3.14 dla api
cp apps/web/.env.example apps/web/.env.local
npm run dev                                    # web :5173 i api :8000 naraz
```

| Polecenie (z katalogu głównego) | Co robi |
| --- | --- |
| `npm run dev` | web i api z przeładowaniem na żywo |
| `npm run lint` | ESLint (web) i Ruff (api) |
| `npm run typecheck` | TypeScript (web) |
| `npm test` | Vitest (web) i pytest (api) |
| `npm run build` | build produkcyjny web |

Frontend bez backendu: `NEXT_PUBLIC_USE_MOCKS=true` w `apps/web/.env.local` (dane demonstracyjne).
CI (`.github/workflows/ci.yml`) uruchamia te same kroki oraz `docker compose build`.
