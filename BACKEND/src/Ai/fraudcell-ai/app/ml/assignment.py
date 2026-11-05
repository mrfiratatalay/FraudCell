"""Analist aday siralamasi.

assignment_score = expertise_match*0.50 + capacity_ratio*0.30 + performance*0.20

AI Service yalnizca ONERIR; Transaction Service kapasiteyi authoritative
olarak dogrulayip atamayi kesinlestirir.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import AnalystPerformanceProjection, AnalystProfileProjection, AnalystWorkloadProjection

EXPERTISE_WEIGHT = 0.50
CAPACITY_WEIGHT = 0.30
PERFORMANCE_WEIGHT = 0.20
MAX_CAPACITY = 10
DEFAULT_PERFORMANCE = 0.50


@dataclass(frozen=True)
class AnalystCandidate:
    analyst_id: str
    rank: int
    score: float
    expertise_score: float
    capacity_score: float
    performance_score: float


async def rank_candidates(session: AsyncSession, fraud_type: str, region: str | None = None) -> list[AnalystCandidate]:
    profiles = (
        await session.execute(
            select(AnalystProfileProjection).where(
                AnalystProfileProjection.is_active.is_(True),
                AnalystProfileProjection.assignment_enabled.is_(True),
            )
        )
    ).scalars().all()

    if not profiles:
        return []

    analyst_ids = [p.analyst_id for p in profiles]

    workloads = {
        w.analyst_id: w
        for w in (await session.execute(
            select(AnalystWorkloadProjection).where(AnalystWorkloadProjection.analyst_id.in_(analyst_ids))
        )).scalars().all()
    }
    performances = {
        p.analyst_id: p
        for p in (await session.execute(
            select(AnalystPerformanceProjection).where(AnalystPerformanceProjection.analyst_id.in_(analyst_ids))
        )).scalars().all()
    }

    scored: list[tuple[float, int, str, AnalystCandidate]] = []

    for profile in profiles:
        specialties = profile.specialties or []
        if region and profile.regions and region not in profile.regions:
            continue

        expertise_score = 1.0 if fraud_type in specialties else 0.0

        workload = workloads.get(profile.analyst_id)
        active_count = workload.active_case_count if workload else 0
        capacity_score = max(0.0, 1 - (active_count / MAX_CAPACITY))

        performance = performances.get(profile.analyst_id)
        performance_score = float(performance.performance_score) if performance else DEFAULT_PERFORMANCE

        total_score = (
            expertise_score * EXPERTISE_WEIGHT + capacity_score * CAPACITY_WEIGHT + performance_score * PERFORMANCE_WEIGHT
        )

        scored.append((total_score, active_count, profile.analyst_id, AnalystCandidate(
            analyst_id=profile.analyst_id,
            rank=0,
            score=round(total_score, 5),
            expertise_score=expertise_score,
            capacity_score=round(capacity_score, 5),
            performance_score=round(performance_score, 5),
        )))

    # Tie-break: 1) en yuksek skor, 2) daha az aktif vaka,
    # 3) analyst_id lexical order (performansa gore ikincil siralama zaten skora dahildir).
    scored.sort(key=lambda item: (-item[0], item[1], item[2]))

    ranked: list[AnalystCandidate] = []
    for index, (_, _, _, candidate) in enumerate(scored[:5], start=1):
        ranked.append(AnalystCandidate(
            analyst_id=candidate.analyst_id,
            rank=index,
            score=candidate.score,
            expertise_score=candidate.expertise_score,
            capacity_score=candidate.capacity_score,
            performance_score=candidate.performance_score,
        ))

    return ranked
