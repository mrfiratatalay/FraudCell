# Build with BACKEND/ as the Docker build context.
FROM ghcr.io/astral-sh/uv:0.11.31 AS uv

FROM python:3.13.14-slim-bookworm AS base
WORKDIR /app

COPY --from=uv /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY src/Ai/fraudcell-ai/pyproject.toml src/Ai/fraudcell-ai/uv.lock ./

# ---- Train ----
# The model is trained while the image is built, so a fresh clone needs no
# pre-built artefacts. Training is deterministic (fixed seed) and the
# training-only dependencies (pandas) never reach the runtime image.
FROM base AS train
RUN uv sync --frozen --no-dev --group training --no-install-project

COPY src/Ai/fraudcell-ai/app ./app
COPY src/Ai/fraudcell-ai/train.py ./
COPY src/Ai/fraudcell-ai/data ./data
RUN python train.py

# ---- Runtime ----
FROM base AS runtime

ENV AI_HTTP_HOST=0.0.0.0 \
    AI_HTTP_PORT=8000

RUN uv sync --frozen --no-dev --no-install-project

COPY src/Ai/fraudcell-ai/app ./app
COPY --from=train /app/models ./models
RUN uv sync --frozen --no-dev \
    && groupadd --system fraudcell \
    && useradd --system --gid fraudcell --home-dir /app --shell /usr/sbin/nologin fraudcell \
    && chown -R fraudcell:fraudcell /app

EXPOSE 8000
USER fraudcell

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD python -c "import json, urllib.request; response=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=3)); assert response['status'] == 'Healthy'" || exit 1

CMD ["python", "-m", "app.run"]
