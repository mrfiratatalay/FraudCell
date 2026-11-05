"""Access control for the AI's public API (case §3.3, §10).

Every /api/v1/ai/* call carries Identity's access token. The service checks it
itself, like the .NET services do: RS256 signature against Identity's JWKS,
issuer, audience and expiry. The keys are cached; a token with an unknown kid
(key rotation) makes PyJWKClient download the set again. A wrong role gets 403,
and the 403 is written to this service's outbox as audit.entry.requested, the
same payload BuildingBlocks' AuthorizationDeniedAuditMiddleware sends.
The gateway in front only requires a valid token, so each 403 is audited once.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import urllib.request
from collections.abc import Awaitable, Callable
from typing import Any

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient
from ulid import ULID

from app.config import settings
from app.database import SessionFactory
from app.messaging import outbox

logger = logging.getLogger(__name__)

STAFF = ("ANALYST", "SUPERVISOR", "ADMIN")
SUPERVISOR_OR_ADMIN = ("SUPERVISOR", "ADMIN")


class SigningKeys:
    """Identity's public keys, found through its OpenID discovery document."""

    def __init__(self, metadata_address: str) -> None:
        self._metadata_address = metadata_address
        self._client: PyJWKClient | None = None

    def for_token(self, token: str) -> Any:
        if self._client is None:
            with urllib.request.urlopen(self._metadata_address, timeout=5) as response:
                jwks_uri = json.load(response)["jwks_uri"]
            self._client = PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600, timeout=5)
        return self._client.get_signing_key_from_jwt(token).key


signing_keys = SigningKeys(settings.jwt.metadata_address)


def validate(token: str) -> dict[str, Any]:
    """Claims of a valid token; raises jwt.PyJWTError otherwise."""
    return jwt.decode(
        token,
        signing_keys.for_token(token),
        algorithms=["RS256"],
        audience=settings.jwt.audience,
        issuer=settings.jwt.issuer,
        leeway=settings.jwt.clock_skew_seconds,
        options={"require": ["exp", "iss", "aud", "sub"]},
    )


def _client_ip(request: Request) -> str | None:
    # Behind the gateway the TCP peer is the gateway; YARP passes the caller in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)


def denied_audit_payload(request: Request, claims: dict[str, Any]) -> dict[str, Any]:
    return {
        "actorId": claims.get("sub"),
        "actorRole": claims.get("role"),
        "action": "AUTHORIZATION_DENIED",
        "sourceService": settings.service_name,
        "resourceType": "http_endpoint",
        "resourceId": request.url.path,
        "ipAddress": _client_ip(request),
        "result": "FAILURE",
        "occurredAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "details": {"method": request.method},
    }


async def record_denied(request: Request, claims: dict[str, Any]) -> None:
    payload = denied_audit_payload(request, claims)
    try:
        async with SessionFactory() as session:
            session.add(outbox.enqueue(
                event_type="audit.entry.requested",
                subject_id=payload["actorId"] or payload["resourceId"],
                payload=payload,
                correlation_id=request.headers.get("x-correlation-id") or str(ULID()),
            ))
            await session.commit()
    except Exception:
        # The 403 is still returned; a failed audit must not turn it into a 500.
        logger.exception("Could not record the authorization-denied audit event.")


def require_roles(*roles: str) -> Callable[[Request], Awaitable[dict[str, Any]]]:
    async def dependency(request: Request) -> dict[str, Any]:
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Access token gerekli.")
        try:
            claims = await asyncio.to_thread(validate, header[7:].strip())
        except jwt.PyJWKClientConnectionError as error:
            raise HTTPException(status_code=503, detail="Imza anahtarlari alinamadi.") from error
        except (jwt.PyJWTError, OSError, KeyError) as error:
            raise HTTPException(status_code=401, detail="Access token geçersiz veya süresi dolmuş.") from error

        if claims.get("role") not in roles:
            await record_denied(request, claims)
            raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok.")
        return claims

    return dependency
