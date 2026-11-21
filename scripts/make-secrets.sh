#!/usr/bin/env sh
# Tworzy sekrety dla docker compose. Skrypt jest idempotentny:
# istniejących plików nie nadpisuje, więc wydane tokeny pozostają ważne.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/secrets"
JWT="$SECRETS/jwt_secret.txt"

mkdir -p "$SECRETS"
chmod 700 "$SECRETS"

if [ -s "$JWT" ]; then
  echo "Sekret JWT już istnieje: $JWT (bez zmian)"
else
  command -v openssl >/dev/null 2>&1 || { echo "Brak polecenia openssl." >&2; exit 1; }
  umask 077
  openssl rand -base64 48 | tr -d '\n' > "$JWT"
  # Katalog zostaje 700 (chroni przed innymi kontami na hoście), a plik musi być
  # czytelny dla nieuprzywilejowanego użytkownika kontenera (uid 10001).
  chmod 644 "$JWT"
  echo "Utworzono sekret JWT: $JWT"
fi
