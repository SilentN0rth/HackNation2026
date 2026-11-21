#!/usr/bin/env sh
# Pobiera model LLM do wolumenu Ollamy RAZ, przed demo (na obronie może nie być sieci).
# Użycie: ./backend/scripts/pull_model.sh [model]   (domyślnie qwen3:4b, Apache-2.0)
set -eu
MODEL="${1:-${LLM_MODEL:-qwen3:4b}}"
docker compose --profile llm up -d ollama
docker compose exec ollama ollama pull "$MODEL"
docker compose exec ollama ollama list
echo "Gotowe. Uruchom API z LLM_ENABLED=true LLM_MODEL=$MODEL"
