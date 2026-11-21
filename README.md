# HackNation2026 – Cyfryzacja formularzy (COI)

Stary formularz urzędowy (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG) → **JSON w formacie COI** z podstawą prawną pól,
linterami jakości i edytorem dla urzędnika. „AI napisało, kod sprawdził, urzędnik zdecydował.”

| Katalog | Zawartość |
|---|---|
| [`backend/`](backend/README.md) | FastAPI: konwersja, lintery, wersje robocze, Audit Trail, API dla frontendu |
| [`frontend/`](frontend/README.md) | Next.js 16 + HeroUI + Zod: edytor urzędnika i e-usługa obywatela |
| [`outputs/`](outputs/) | **wynikowe pliki JSON** dla 9 formularzy z materiałów COI (+ `raport.json`) |
| [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md) | dokumentacja architektury z diagramem |
| [`BACKEND_PLAN.md`](BACKEND_PLAN.md) | plan realizacji i decyzje |
| `data-pdf/` | materiały COI (formularze w 7–8 formatach, wzorcowe JSON-y, reguły) |

## Uruchomienie

```bash
mkdir -p secrets && openssl rand -base64 48 > secrets/jwt_secret
docker compose up --build          # API http://localhost:8000/docs · frontend http://localhost:3000
```

Minimum COI z linii poleceń:

```bash
curl -F file=@formularz.pdf http://localhost:8000/api/v1/convert > formularz.json
```

Szczegóły (konfiguracja, API, licencje, testy): [`backend/README.md`](backend/README.md).
