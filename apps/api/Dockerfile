FROM python:3.14.9-alpine3.24 AS deps
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.14.9-alpine3.24
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-pol libreoffice-writer font-dejavu \
    && (command -v soffice || ln -s /usr/lib/libreoffice/program/soffice /usr/local/bin/soffice) \
    && addgroup -S -g 10001 app \
    && adduser -S -D -H -u 10001 -G app app \
    && mkdir -p /data \
    && chown app:app /data
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    DB_PATH=/data/app.db \
    ATTACHMENTS_DIR=/data/attachments \
    SOFFICE_CMD=soffice \
    TESSERACT_CMD=tesseract
WORKDIR /app
COPY --from=deps /install /usr/local
COPY app ./app
COPY data/dictionaries.json data/prefill_demo.json ./data/
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8000}/health" || exit 1
# PORT i HOST nadpisuje hosting (Railway: PORT z platformy, HOST=:: dla sieci prywatnej IPv6); domyślnie jak w compose.
CMD ["sh", "-c", "exec uvicorn app.main:app --host \"${HOST:-0.0.0.0}\" --port \"${PORT:-8000}\" --no-server-header"]
