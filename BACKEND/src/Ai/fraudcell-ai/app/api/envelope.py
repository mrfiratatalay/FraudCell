"""Standart API zarfi. Tum servislerde ayni sekil."""

from __future__ import annotations

from typing import Any

from ulid import ULID


def ok(data: Any, generated_at: str | None = None) -> dict[str, Any]:
    meta: dict[str, Any] = {"traceId": str(ULID())}
    if generated_at is not None:
        meta["generatedAt"] = generated_at

    return {"success": True, "data": data, "error": None, "meta": meta}
