#!/usr/bin/env sh
# Tworzy sekrety dla docker compose. Skrypt jest idempotentny:
# istniejących plików nie nadpisuje, więc wydane tokeny pozostają ważne.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/secrets"
JWT="$SECRETS/jwt_secret.txt"
PAYLOAD="$SECRETS/payload_secret.txt"

mkdir -p "$SECRETS"
chmod 700 "$SECRETS"

# make_secret <plik> <opis>
make_secret() {
  if [ -s "$1" ]; then
    echo "$2 już istnieje: $1 (bez zmian)"
    return
  fi
  command -v openssl >/dev/null 2>&1 || { echo "Brak polecenia openssl." >&2; exit 1; }
  (umask 077 && openssl rand -base64 48 | tr -d '\n' > "$1")
  # Katalog zostaje 700 (chroni przed innymi kontami na hoście), a plik musi być
  # czytelny dla nieuprzywilejowanego użytkownika kontenera (api: uid 10001, web: node).
  chmod 644 "$1"
  echo "Utworzono $2: $1"
}

make_secret "$JWT" "sekret JWT"
make_secret "$PAYLOAD" "sekret Payloada"
