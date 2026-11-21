# syntax=docker/dockerfile:1
# Debian slim (glibc), nie Alpine: Tesseract, LibreOffice i koła Pythona (rapidfuzz, lxml, pillow) działają na glibc
# bez kompilacji; na musl trzeba by je budować ze źródeł, a obraz wcale nie byłby mniejszy.
ARG PYTHON_IMAGE=python:3.14-slim-bookworm@sha256:3fe1a0b6c2d6b2ebb572906cdabeca75aeb558c0c17db5ffefbcf8094871c32b

# ---------- etap 1: zależności Pythona (uv, przypięte w uv.lock) ----------
FROM ${PYTHON_IMAGE} AS deps
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
RUN pip install --no-cache-dir uv==0.13.9
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ---------- etap 2: obraz uruchomieniowy ----------
FROM ${PYTHON_IMAGE} AS runtime
ARG WITH_LIBREOFFICE=false
# OCR (Apache-2.0) w osobnej warstwie; LibreOffice (MPL-2.0, osobny proces) tylko na żądanie – DOC obsługuje
# też własny parser (app/extract/doc.py), więc domyślnie oszczędzamy ~400 MB.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-pol \
 && if [ "$WITH_LIBREOFFICE" = "true" ]; then apt-get install -y --no-install-recommends libreoffice-writer-nogui; fi \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=deps /app/.venv /app/.venv
COPY app ./app
COPY data/dictionaries ./data/dictionaries
COPY data/statutes ./data/statutes
COPY data/prefill_mock.json ./data/prefill_mock.json

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    DB_PATH=/var/lib/coi/coi.sqlite3 \
    HOME=/tmp
RUN mkdir -p /var/lib/coi && chown app:app /var/lib/coi
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
