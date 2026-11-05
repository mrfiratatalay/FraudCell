"""Aciliste model registry'i yukler ve DB'de model_versions/model_bundles
satirlarini idempotent olarak olusturur.

Training script (train.py) DB baglantisi olmadan calisabilir; bu modul
uretilen `metadata.json`'i okuyup gerekli kayitlari senkronize eder.
"""

from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy import select

from app.database import SessionFactory
from app.ml.model_registry import registry
from app.models.ai import ModelBundle, ModelVersion

logger = logging.getLogger(__name__)


async def bootstrap_models() -> None:
    registry.load()
    metadata = registry.metadata
    assert metadata is not None

    now = dt.datetime.now(dt.timezone.utc)

    async with SessionFactory() as session:
        risk_version = await _upsert_model_version(
            session, kind="RISK", metadata=metadata["riskModel"], now=now
        )
        fraud_type_version = await _upsert_model_version(
            session, kind="FRAUD_TYPE", metadata=metadata["fraudTypeModel"], now=now
        )

        # PostgreSQL en fazla bir ACTIVE bundle'a izin veriyor. Yeni artifact
        # surumu geldiyse once eski bundle'i emekliye ayir; aksi halde ayni
        # transaction icindeki INSERT partial unique index'e takilir.
        active_bundles = (
            await session.execute(select(ModelBundle).where(ModelBundle.status == "ACTIVE"))
        ).scalars().all()

        bundle = (
            await session.execute(select(ModelBundle).where(ModelBundle.bundle_version == metadata["bundleVersion"]))
        ).scalar_one_or_none()

        for active_bundle in active_bundles:
            if bundle is None or active_bundle.id != bundle.id:
                active_bundle.status = "RETIRED"
                active_bundle.retired_at = now
        await session.flush()

        if bundle is None:
            from ulid import ULID

            bundle = ModelBundle(
                id=str(ULID()),
                bundle_version=metadata["bundleVersion"],
                risk_model_id=risk_version.id,
                fraud_type_model_id=fraud_type_version.id,
                status="ACTIVE",
                activated_at=now,
                created_at=now,
            )
            session.add(bundle)
        else:
            # Ayni bundleVersion yeniden kullanilsa bile model baglantilarini
            # metadata ile senkron tut. Bootstrap tekrar tekrar calisabilmeli.
            bundle.risk_model_id = risk_version.id
            bundle.fraud_type_model_id = fraud_type_version.id
            bundle.status = "ACTIVE"
            bundle.activated_at = now
            bundle.retired_at = None

        await session.commit()
        logger.info("Model bundle '%s' is ACTIVE (risk=%s, fraudType=%s).", metadata["bundleVersion"], risk_version.semantic_version, fraud_type_version.semantic_version)


async def _upsert_model_version(session, *, kind: str, metadata: dict, now: dt.datetime) -> ModelVersion:  # type: ignore[no-untyped-def]
    existing = (
        await session.execute(
            select(ModelVersion).where(ModelVersion.model_kind == kind, ModelVersion.semantic_version == metadata["version"])
        )
    ).scalar_one_or_none()

    active_versions = (
        await session.execute(
            select(ModelVersion).where(ModelVersion.model_kind == kind, ModelVersion.status == "ACTIVE")
        )
    ).scalars().all()

    # Yeni surumu ACTIVE yapmadan once o model turundeki eski ACTIVE kaydi
    # emekliye ayir. Explicit flush, partial unique index kontrolunden once
    # UPDATE'in veritabanina gitmesini garanti eder.
    for active_version in active_versions:
        if existing is None or active_version.id != existing.id:
            active_version.status = "RETIRED"
            active_version.retired_at = now
    await session.flush()

    if existing is not None:
        existing.algorithm = metadata["algorithm"]
        existing.artifact_path = metadata["artifactPath"]
        existing.artifact_sha256 = metadata["artifactSha256"]
        existing.metrics = metadata["metrics"]
        existing.status = "ACTIVE"
        existing.activated_at = now
        existing.retired_at = None
        await session.flush()
        return existing

    from ulid import ULID

    version = ModelVersion(
        id=str(ULID()),
        model_kind=kind,
        semantic_version=metadata["version"],
        algorithm=metadata["algorithm"],
        artifact_path=metadata["artifactPath"],
        artifact_sha256=metadata["artifactSha256"],
        metrics=metadata["metrics"],
        status="ACTIVE",
        created_at=now,
        activated_at=now,
    )
    session.add(version)
    await session.flush()
    return version
