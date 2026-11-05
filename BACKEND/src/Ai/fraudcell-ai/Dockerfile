# Build with BACKEND/ as the Docker build context.
FROM ghcr.io/astral-sh/uv:0.11.31 AS uv

# ---- Dependencies ----
# Runtime dependencies only, in /app/.venv. The app itself is not installed:
# it runs from /app, which is on sys.path for `python -m app.run`.
FROM python:3.13.14-slim-bookworm AS deps
WORKDIR /app

COPY --from=uv /uv /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

COPY src/Ai/fraudcell-ai/pyproject.toml src/Ai/fraudcell-ai/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ---- Train ----
# The model is trained while the image is built, from the committed data in
# data/. Training is deterministic (fixed seed); pandas, which only training
# needs, is added to this stage's copy of the venv and never reaches runtime.
FROM deps AS train
RUN uv sync --frozen --no-dev --group training --no-install-project

COPY src/Ai/fraudcell-ai/app ./app
COPY src/Ai/fraudcell-ai/train.py ./
COPY src/Ai/fraudcell-ai/data ./data
RUN /app/.venv/bin/python train.py

# ---- Runtime ----
# No uv, no build tools, no chown -R (which rewrote the whole venv in a second
# layer): files stay root-owned and read-only for the service user.
FROM python:3.13.14-slim-bookworm AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    AI_HTTP_HOST=0.0.0.0 \
    AI_HTTP_PORT=8000

RUN groupadd --system fraudcell \
    && useradd --system --gid fraudcell --home-dir /app --shell /usr/sbin/nologin fraudcell

COPY --from=deps /app/.venv ./.venv
COPY src/Ai/fraudcell-ai/alembic.ini ./
COPY src/Ai/fraudcell-ai/migrations ./migrations
COPY src/Ai/fraudcell-ai/app ./app
COPY --from=train /app/models ./models

EXPOSE 8000
USER fraudcell

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD python -c "import json, urllib.request; response=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=3)); assert response['status'] == 'Healthy'" || exit 1

CMD ["python", "-m", "app.run"]
