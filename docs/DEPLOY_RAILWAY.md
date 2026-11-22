# Wdrożenie na Railway

Railway nie uruchamia `docker-compose.yml` wprost: każda usługa z compose to osobna usługa w jednym projekcie
Railway, zbudowana z tego samego `Dockerfile`. Ollama (profil `llm`) nie jest potrzebna – model językowy idzie przez
Eden AI.

| Usługa | Katalog (Root Directory) | Konfiguracja | Wolumen | Domena publiczna |
| --- | --- | --- | --- | --- |
| `api` | `apps/api` | `/apps/api/railway.json` | `/data` | tak (przeglądarka pobiera token JWT) |
| `web` | `apps/web` | `/apps/web/railway.json` | `/app/data` | tak |

Różnice względem compose:

- **Sekrety** – zamiast plików z `secrets/` zmienne `JWT_SECRET` (api) i `PAYLOAD_SECRET` (web).
- **Port** – Railway podaje `PORT`; API czyta go w `CMD`, Next.js (`server.js`) też.
- **Sieć prywatna** – `web` woła API pod `api.railway.internal:8000` (IPv4 działa). Nie ustawiaj `HOST=::`: uvicorn otwiera wtedy
  gniazdo tylko IPv6 i publiczna domena zwraca 502.
- **`VOLUME`** – Railway odrzuca tę instrukcję w Dockerfile, wolumeny podpina się w ustawieniach usługi.
- **Wolumeny** – Railway montuje je jako `root`, a obrazy działają jako zwykły użytkownik, więc `RAILWAY_RUN_UID=0`.
- `read_only`, `tmpfs` i `cap_drop` z compose nie mają odpowiednika – izolację zapewnia platforma.

## Zmienne

`api`:

| Zmienna | Wartość |
| --- | --- |
| `PORT` | `8000` (potrzebne do odwołania `${{api.PORT}}` w usłudze web) |
| `JWT_SECRET` | losowy, np. `openssl rand -base64 48` |
| `CORS_ORIGINS` | `["https://${{web.RAILWAY_PUBLIC_DOMAIN}}"]` |
| `RAILWAY_RUN_UID` | `0` |
| `LLM_ENABLED` / `LLM_PROVIDER` | `true` / `edenai` |
| `EDENAI_API_KEY` | klucz zespołu – wpisz sam w panelu Railway, nie w repozytorium |
| `API_KEY` | losowy, np. `openssl rand -hex 24` – klucz do publicznego `POST /api/v1/convert` (nagłówek `X-API-Key`) |
| `TOKEN_CLIENT_SECRET` | losowy – `/auth/token` wydaje token tylko klientowi z tym sekretem |

`web` (zmienne `NEXT_PUBLIC_*` są wkompilowane podczas buildu – po zmianie trzeba przebudować usługę):

| Zmienna | Wartość |
| --- | --- |
| `PORT` | `8080` |
| `NEXT_PUBLIC_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| `NEXT_PUBLIC_USE_MOCKS` | `false` |
| `FASTAPI_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |
| `PAYLOAD_SECRET` | losowy, np. `openssl rand -base64 48` |
| `PAYLOAD_SEED` | `true` (konto i dane demo przy starcie) |
| `SEED_PASSWORD` | silne hasło – strona jest publiczna, `demo1234` nie wystarczy |
| `TOKEN_CLIENT_SECRET` | `${{api.TOKEN_CLIENT_SECRET}}` – serwer frontu podaje go przy pobieraniu tokenu |
| `DEMO_LOGIN` | `true` – przycisk „Zaloguj jako urzędnik (demo)” (konto bez uprawnień administratora) |
| `RAILWAY_RUN_UID` | `0` |

## Kroki (CLI)

```bash
npx @railway/cli login
npx @railway/cli init --name e-formularze
npx @railway/cli add --service api
npx @railway/cli add --service web
# zmienne z tabel powyżej: railway variables --service <usługa> --set "KLUCZ=wartość"
# wolumeny: api → /data, web → /app/data; domeny: railway domain --service <usługa>
cd apps/api && npx @railway/cli up --service api
cd ../web && npx @railway/cli up --service web
```

`railway up` wysyła katalog z pominięciem plików z `.gitignore`, a obraz buduje się z `.dockerignore` – lokalny
`.env` z kluczami nie trafia na serwer.

Po wdrożeniu: panel urzędnika `https://<domena web>/official` (konto `urzednik@example.gov.pl`, hasło z `SEED_PASSWORD`).

## Publiczne REST API pod domeną web

Usługa web przekazuje `/api/v1/*`, `/docs` i `/openapi.json` do API po sieci prywatnej, więc REST API działa pod tą samą domeną co aplikacja:

```bash
curl -H "X-API-Key: $API_KEY" -F "file=@wniosek.pdf" https://e-formularze.up.railway.app/api/v1/convert
```

`/auth/token` i ścieżki edytora nie są wystawiane pod domeną web. Bez ważnego klucza `X-API-Key` albo tokenu JWT konwersja zwraca 401.
