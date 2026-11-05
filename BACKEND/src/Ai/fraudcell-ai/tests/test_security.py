"""The AI checks Identity's access token itself and audits its 403s (case §3.3, §10)."""

from __future__ import annotations

import datetime as dt
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import security
from app.config import settings

IDENTITY_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ATTACKER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _StubKeys:
    def for_token(self, _token: str) -> Any:
        return IDENTITY_KEY.public_key()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, list[dict[str, Any]]]:
    audits: list[dict[str, Any]] = []

    async def capture(request: Any, claims: dict[str, Any]) -> None:
        audits.append(security.denied_audit_payload(request, claims))

    monkeypatch.setattr(security, "signing_keys", _StubKeys())
    monkeypatch.setattr(security, "record_denied", capture)

    app = FastAPI()

    @app.get("/api/v1/ai/metrics/overview", dependencies=[Depends(security.require_roles(*security.SUPERVISOR_OR_ADMIN))])
    async def overview() -> dict:
        return {"ok": True}

    return TestClient(app), audits


def _token(key: Any = IDENTITY_KEY, algorithm: str = "RS256", **overrides: Any) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    claims = {"sub": "user-1", "role": "SUPERVISOR", "iss": settings.jwt.issuer, "aud": settings.jwt.audience,
              "iat": now, "exp": now + dt.timedelta(minutes=15)} | overrides
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": "identity-key"})


def _get(client: TestClient, token: str | None) -> int:
    headers = {"Authorization": f"Bearer {token}", "X-Forwarded-For": "203.0.113.7"} if token else {}
    return client.get("/api/v1/ai/metrics/overview", headers=headers).status_code


def test_supervisor_with_a_valid_token_is_let_in(client: tuple[TestClient, list]) -> None:
    assert _get(client[0], _token()) == 200


@pytest.mark.parametrize(
    "token",
    [
        None,
        "not.a.jwt",
        "expired",
        "another issuer",
        "another audience",
        "attacker key",
        "alg none",
    ],
)
def test_missing_or_bad_token_is_refused_with_401(client: tuple[TestClient, list], token: str | None) -> None:
    now = dt.datetime.now(dt.timezone.utc)
    tokens = {
        "expired": _token(exp=now - dt.timedelta(minutes=5), iat=now - dt.timedelta(minutes=20)),
        "another issuer": _token(iss="https://attacker.example"),
        "another audience": _token(aud="another-api"),
        "attacker key": _token(key=ATTACKER_KEY),
        "alg none": jwt.encode({"sub": "user-1", "role": "ADMIN"}, key=None, algorithm="none"),
    }
    assert _get(client[0], tokens.get(token or "", token)) == 401
    assert client[1] == []


def test_wrong_role_gets_403_and_one_audit_entry(client: tuple[TestClient, list]) -> None:
    test_client, audits = client

    assert _get(test_client, _token(role="CUSTOMER", sub="customer-9")) == 403

    assert len(audits) == 1
    audit = audits[0]
    assert audit["actorId"] == "customer-9"
    assert audit["actorRole"] == "CUSTOMER"
    assert audit["action"] == "AUTHORIZATION_DENIED"
    assert audit["sourceService"] == "ai-service"
    assert audit["resourceType"] == "http_endpoint"
    assert audit["resourceId"] == "/api/v1/ai/metrics/overview"
    assert audit["ipAddress"] == "203.0.113.7"
    assert audit["result"] == "FAILURE"
    assert audit["details"] == {"method": "GET"}
