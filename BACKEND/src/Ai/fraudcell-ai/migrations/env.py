"""Alembic environment: the AI service's async engine, its "ai" schema, its models."""

from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401 - registers every mapped table on Base.metadata
from app.config import settings
from app.database import Base

SCHEMA = "ai"


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
        include_name=lambda name, type_, _: type_ != "schema" or name == SCHEMA,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def _run() -> None:
    # A private engine: Alembic runs in a worker thread with its own event loop.
    engine = create_async_engine(settings.database.dsn, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(_configure)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=settings.database.dsn, target_metadata=Base.metadata, version_table_schema=SCHEMA,
                      literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(_run())
