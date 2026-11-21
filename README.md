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

API: `http://localhost:8000`, dokumentacja: `http://localhost:8000/docs`.
