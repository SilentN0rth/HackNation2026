# e-Formularze – HackNation 2026, wyzwanie COI

Zamiana papierowych formularzy urzędowych na formularze elektroniczne w formacie JSON COI.

| Katalog | Zawartość |
| --- | --- |
| `backend/` | Usługa REST (Python 3.14, FastAPI): `POST /api/v1/convert` i edytor wersji roboczych. Instrukcja w `backend/README.md` |
| `frontend/` | Aplikacja dla urzędnika i podgląd e-usługi dla obywatela |
| `outputs/` | Wynikowe pliki JSON dla formularzy z wyzwania i raport |
| `data-pdf/` | Materiały i przykładowe formularze od organizatorów |

## Uruchomienie

```bash
mkdir -p secrets && openssl rand -base64 48 > secrets/jwt_secret.txt
docker compose up -d --build
```

| Adres | Co tam jest |
| --- | --- |
| `http://localhost:5173` | Aplikacja: urzędnik wgrywa formularz, poprawia go w edytorze i publikuje, obywatel wypełnia e-usługę |
| `http://localhost:8000` | REST API, minimum z wyzwania: `POST /api/v1/convert` |
| `http://localhost:8000/docs` | Opis API (OpenAPI) |

Bez Dockera:

```bash
cd backend && python3.14 -m venv .venv && .venv/bin/pip install -r requirements.txt
JWT_SECRET=dowolny-dlugi-sekret .venv/bin/uvicorn app.main:app --port 8000

cd frontend && npm install && cp .env.example .env.local && npm run dev
```
