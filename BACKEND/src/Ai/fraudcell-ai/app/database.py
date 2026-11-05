"""SQLAlchemy engine ve oturum yonetimi.

psycopg3, ayni "postgresql+psycopg://" dialect'i hem sync hem async
motorlarda destekler; ayri bir "psycopg_async" surucusune gerek yoktur.
"""

from __future__ import annotations

import asyncio
import sys
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


# psycopg async connections require a selector loop on Windows. Set the policy
# before uvicorn or a one-shot migration creates the first event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


class Base(DeclarativeBase):
    """Tum ORM modellerinin ortak temeli; `ai` schema'sinda yasar."""


engine = create_async_engine(settings.database.dsn, pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession]:
    async with SessionFactory() as session:
        yield session
