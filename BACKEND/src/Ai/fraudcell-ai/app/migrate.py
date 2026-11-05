"""Schema migration for the AI service's own database, with Alembic (migrations/).

Applied at service startup (see app.main.lifespan), mirroring the
`db.Database.MigrateAsync()` call the .NET services make. Also runnable
standalone as a one-shot container:

    docker compose --profile migration run --rm ai-migrate

New schema change: edit app/models, then
    uv run alembic revision --autogenerate -m "what changed"
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.database import engine

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

# The first revision matches the schema that metadata.create_all used to build.
BASELINE_REVISION = "0001"


async def migrate() -> None:
    """Idempotent; safe to run on every startup. Does NOT dispose the engine,
    because in-process callers keep using it afterwards."""
    async with engine.begin() as connection:
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS ai"))
        created_before_alembic = await connection.scalar(text(
            "SELECT to_regclass('ai.predictions') IS NOT NULL AND to_regclass('ai.alembic_version') IS NULL"
        ))

    config = Config(str(ALEMBIC_INI))
    # Alembic's env.py runs its own event loop, so it gets a worker thread.
    if created_before_alembic:
        await asyncio.to_thread(command.stamp, config, BASELINE_REVISION)
    await asyncio.to_thread(command.upgrade, config, "head")


async def _run_standalone() -> None:
    await migrate()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_run_standalone())
