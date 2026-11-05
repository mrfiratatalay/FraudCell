"""FraudCell security checks: the attacks the jury will try live (case §10).

Runs against the public gateway, like scripts/demo.py, and needs the demo staff
(`demo.py seed`). Run it last: the brute-force step uses up this IP's login and
OTP budget for a minute.

    python3 scripts/security.py
"""

from __future__ import annotations

import base64
import json
import pathlib
import re
import sys
import time
import uuid

from demo import (ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_ANALYSTS, STAFF_PASSWORD, SUPERVISOR_EMAIL, call, check,
                  create_high_risk_transaction, customer_login, data_of, failures, items_of, staff_login,
                  wait_for_assessment, wait_for_gateway)

SQL_INJECTION = "' OR 1=1 --"
XSS = "<script>alert(1)</script>"
FRONTEND_SRC = pathlib.Path(__file__).resolve().parent.parent / "FRONTEND" / "app" / "src"


def user_id(token: str) -> str | None:
    payload = data_of(call("GET", "/api/v1/auth/me", token)[1])
    return payload.get("id") or payload.get("userId")


def status_of(method: str, path: str, token: str | None, body: object | None = None) -> int:
    return call(method, path, token, body)[0]


def role_matrix(tokens: dict[str, str]) -> None:
    """Case §3.3: every protected endpoint answers 401 without a token and 403 to the wrong role."""
    # (method, path, roles that may call it)
    endpoints = [
        ("GET", "/api/v1/game/leaderboard?period=daily", {"ANALYST", "SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/game/badges", {"ANALYST", "SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/cases", {"SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/cases/assignment-queue", {"SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/cases/assigned", {"ANALYST"}),
        ("GET", "/api/v1/staff", {"SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/audit-logs", {"ADMIN"}),
        ("GET", "/api/v1/ai/metrics/overview", {"SUPERVISOR", "ADMIN"}),
        ("GET", "/api/v1/ai/models/active", {"ANALYST", "SUPERVISOR", "ADMIN"}),
    ]
    for method, path, allowed in endpoints:
        status = status_of(method, path, None)
        check(f"{method} {path} without a token -> 401 (got {status})", status == 401)
        for role, token in tokens.items():
            status = status_of(method, path, token)
            expected_ok = role in allowed
            check(f"{method} {path} as {role} -> {'2xx' if expected_ok else '403'} (got {status})",
                  200 <= status < 300 if expected_ok else status == 403)

    for role in ("ANALYST", "SUPERVISOR", "ADMIN"):
        status = status_of("POST", "/api/v1/transactions", tokens[role], {})
        check(f"POST /api/v1/transactions as {role} -> 403 (got {status})", status == 403)
    for role in ("CUSTOMER", "ANALYST", "SUPERVISOR"):
        status = status_of("POST", "/api/v1/staff", tokens[role], {})
        check(f"POST /api/v1/staff as {role} -> 403 (got {status})", status == 403)


def idor(tokens: dict[str, str]) -> None:
    """Case §10: changing a record id must not reveal or change someone else's data."""
    owner = tokens["CUSTOMER"]
    other_customer = customer_login()
    transaction_id = create_high_risk_transaction(owner)
    transaction = wait_for_assessment(owner, transaction_id) if transaction_id else {}
    case_id = transaction.get("caseId")
    if not (other_customer and transaction_id and case_id):
        check("IDOR setup: a transaction with a case", False, transaction)
        return

    status = status_of("GET", f"/api/v1/transactions/{transaction_id}", other_customer)
    check(f"another customer reads the transaction -> 404 (got {status})", status == 404)
    status = status_of("GET", f"/api/v1/cases/{case_id}", other_customer)
    check(f"another customer reads the case -> 404 (got {status})", status == 404)
    status = status_of("POST", f"/api/v1/cases/{case_id}/verification-responses", other_customer,
                       {"verificationId": "x", "response": "MINE"})
    check(f"another customer answers the case's verification -> 404 (got {status})", status == 404)

    # An analyst of another specialty is not assigned to this case.
    fraud_type = (transaction.get("assessment") or {}).get("fraudType")
    email = next(e for t, (e, _, _) in DEMO_ANALYSTS.items() if t != fraud_type)
    stranger = staff_login(email, STAFF_PASSWORD)
    status = status_of("GET", f"/api/v1/transactions/{transaction_id}", stranger)
    check(f"an unassigned analyst reads the transaction -> 404 (got {status})", status == 404)
    status = status_of("GET", f"/api/v1/cases/{case_id}", stranger)
    check(f"an unassigned analyst reads the case -> 404 (got {status})", status == 404)
    status, _, _ = call("PATCH", f"/api/v1/cases/{case_id}/decision", stranger,
                        {"decision": "BLOCK", "note": "IDOR denemesi"}, {"If-Match": '"1"'})
    check(f"an unassigned analyst decides the case -> 404 (got {status})", status == 404)

    supervisor_id = user_id(tokens["SUPERVISOR"])
    status = status_of("GET", f"/api/v1/game/profiles/{supervisor_id}", tokens["ANALYST"])
    check(f"an analyst reads someone else's game profile -> 403 (got {status})", status == 403)
    status = status_of("GET", f"/api/v1/game/performance/{supervisor_id}", tokens["ANALYST"])
    check(f"an analyst reads someone else's performance -> 403 (got {status})", status == 403)


def _b64(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def _claims(token: str) -> dict:
    payload = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


def jwt_manipulation(customer: str) -> None:
    """Case §10: a modified or unsigned JWT is refused. Expiry, issuer and audience: BuildingBlocks tests."""
    header, _, signature = customer.split(".")
    claims = _claims(customer) | {"role": "ADMIN"}
    forged = {
        "role changed to ADMIN, original signature": f"{header}.{_b64(claims)}.{signature}",
        "alg=none, no signature": f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(claims)}.",
        "signature cut off": f"{header}.{customer.split('.')[1]}.",
        "garbage": "not.a.jwt",
    }
    for label, token in forged.items():
        status = status_of("GET", "/api/v1/audit-logs", token)
        check(f"JWT {label} -> 401 (got {status})", status == 401)


def sql_injection(tokens: dict[str, str]) -> None:
    """Case §10: SQL injection in form fields and filters never errors and never widens a result."""
    status = status_of("POST", "/api/v1/auth/staff/login", None, {"email": SQL_INJECTION, "password": SQL_INJECTION})
    check(f"login with SQL injection -> 400/401 (got {status})", status in (400, 401))
    status = status_of("POST", "/api/v1/auth/customer/otp/challenges", None,
                       {"gsmNumber": SQL_INJECTION, "purpose": "CustomerRegister"})
    check(f"OTP challenge with SQL injection as GSM -> 400 (got {status})", status == 400)

    filters = [
        ("SUPERVISOR", f"/api/v1/transactions?customerId={SQL_INJECTION}"),
        ("ADMIN", f"/api/v1/audit-logs?action={SQL_INJECTION}"),
        ("ADMIN", f"/api/v1/audit-logs?actorId={SQL_INJECTION}"),
    ]
    for role, path in filters:
        status, payload, _ = call("GET", path.replace(" ", "%20"), tokens[role])
        check(f"{role} filter {path.split('?')[1]} -> 200 and no rows (got {status})",
              status == 200 and items_of(payload) == [], payload)

    for role, path in [("SUPERVISOR", f"/api/v1/cases?status={SQL_INJECTION}"),
                       ("CUSTOMER", f"/api/v1/transactions?riskLevel={SQL_INJECTION}"),
                       ("SUPERVISOR", f"/api/v1/cases?cursor={SQL_INJECTION}")]:
        status = status_of("GET", path.replace(" ", "%20"), tokens[role])
        check(f"{role} filter {path.split('?')[1]} -> no server error (got {status})", status < 500)


def xss(admin: str) -> None:
    """Case §10: a script in a text field is stored as text and never runs."""
    status, payload, headers = call("POST", "/api/v1/staff", admin, {
        "firstName": XSS, "lastName": "Test", "email": f"xss.{uuid.uuid4().hex[:8]}@fraudcell.local",
        "password": STAFF_PASSWORD, "role": "SUPERVISOR", "specialties": [], "regions": ["MARMARA"],
        "assignmentEnabled": False})
    check("a script in a staff name is stored as plain text in JSON",
          status == 201 and data_of(payload).get("firstName") == XSS
          and headers.get("Content-Type", "").startswith("application/json")
          and headers.get("X-Content-Type-Options") == "nosniff", payload)

    status, _, headers = call("GET", "/", None)
    csp = headers.get("Content-Security-Policy", "")
    check("the web app is served with a CSP that allows scripts only from itself",
          "script-src 'self'" in csp and "unsafe-inline" not in csp.split("script-src")[1].split(";")[0], csp)

    risky = re.compile(r"dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(")
    hits = [f"{path.relative_to(FRONTEND_SRC)}:{number}"
            for path in FRONTEND_SRC.rglob("*.ts*") if "generated" not in path.parts
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1) if risky.search(line)]
    check("the frontend never renders text as HTML", not hits, hits)


def audit_of_403(customer: str, admin: str) -> None:
    """Case §3.3: an unauthorized call returns 403 and lands in the audit log, once."""
    customer_id = user_id(customer)
    # A .NET service and the AI service each audit their own 403s through their outbox.
    for path in ("/api/v1/cases/assignment-queue", "/api/v1/ai/metrics/overview"):
        status = status_of("GET", path, customer)
        check(f"customer calls {path} -> 403 (got {status})", status == 403)

        entries: list[dict] = []
        for _ in range(20):
            _, payload, _ = call("GET", f"/api/v1/audit-logs?actorId={customer_id}&action=AUTHORIZATION_DENIED", admin)
            entries = [entry for entry in items_of(payload) if entry.get("resourceId") == path]
            if entries:
                break
            time.sleep(1)
        check(f"the 403 on {path} is in the audit log exactly once (got {len(entries)})", len(entries) == 1, entries)


def refresh_cookie(headers: dict) -> str | None:
    match = re.search(r"fraudcell_refresh=([^;]+)", headers.get("Set-Cookie", ""))
    return match.group(1) if match else None


def staff_session(email: str, password: str) -> str | None:
    _, _, headers = call("POST", "/api/v1/auth/staff/login", body={"email": email, "password": password})
    return refresh_cookie(headers)


def refresh(cookie: str | None) -> tuple[int, str | None, dict]:
    status, payload, headers = call("POST", "/api/v1/auth/refresh", headers={"Cookie": f"fraudcell_refresh={cookie}"})
    return status, refresh_cookie(headers), payload


def refresh_token_reuse(email: str) -> None:
    """Case §3.2: reusing a rotated refresh token ends every session of that user."""
    laptop, phone = staff_session(email, STAFF_PASSWORD), staff_session(email, STAFF_PASSWORD)
    status, rotated, _ = refresh(laptop)
    check(f"refresh rotates the token -> 200 (got {status})", status == 200 and rotated not in (None, laptop))

    status, _, payload = refresh(laptop)
    check(f"the old refresh token is refused -> 401 (got {status})", status == 401, payload)
    status, _, _ = refresh(rotated)
    check(f"after the reuse, the rotated token is revoked too -> 401 (got {status})", status == 401)
    status, _, _ = refresh(phone)
    check(f"after the reuse, the user's other session is revoked too -> 401 (got {status})", status == 401)


def account_lockout(email: str) -> None:
    """Case §3.1: five wrong passwords lock a staff account for 15 minutes and say how long."""
    for _ in range(5):
        call("POST", "/api/v1/auth/staff/login", body={"email": email, "password": "Wrong1234!"})
    status, payload, _ = call("POST", "/api/v1/auth/staff/login", body={"email": email, "password": STAFF_PASSWORD})
    check(f"the right password after five wrong ones -> 423 (got {status})", status == 423, payload)
    check("the lock response says how long is left", "remainingSeconds" in json.dumps(payload), payload)


def otp_attempt_limit() -> None:
    """Case §10 brute force: an OTP challenge stops accepting codes after five wrong ones."""
    gsm = f"5{uuid.uuid4().int % 300000000 + 300000000}"
    _, payload, _ = call("POST", "/api/v1/auth/customer/otp/challenges", body={"gsmNumber": gsm, "purpose": "CustomerRegister"})
    challenge_id = data_of(payload).get("challengeId")
    for code in ("0000", "1111", "2222", "3333", "4444"):
        call("POST", "/api/v1/auth/customer/otp/verifications", body={"challengeId": challenge_id, "code": code})
    status, payload, _ = call("POST", "/api/v1/auth/customer/otp/verifications", body={
        "challengeId": challenge_id, "code": "1234", "customer": {"firstName": "Brute", "lastName": "Force", "email": None}})
    check(f"the right OTP after five wrong ones is refused (got {status})",
          status != 200 and not data_of(payload).get("accessToken"), payload)


def rate_limits() -> None:
    """Case §10 brute force: rapid login and OTP requests from one address get 429."""
    for label, path, body in [
        ("staff login", "/api/v1/auth/staff/login", {"email": "nobody@fraudcell.local", "password": "Wrong1234!"}),
        ("OTP request", "/api/v1/auth/customer/otp/challenges", {"gsmNumber": "5300000000", "purpose": "CustomerRegister"}),
    ]:
        statuses = [status_of("POST", path, None, body) for _ in range(40)]
        check(f"40 rapid {label} attempts are throttled with 429 (got {sorted(set(statuses))})", 429 in statuses)


def main() -> None:
    wait_for_gateway()
    admin = staff_login(ADMIN_EMAIL, ADMIN_PASSWORD, retry_seconds=60)
    supervisor = staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD, retry_seconds=60)
    analyst = staff_login(next(iter(DEMO_ANALYSTS.values()))[0], STAFF_PASSWORD)
    customer = customer_login()
    if not (admin and supervisor and analyst and customer):
        sys.exit(1)
    tokens = {"CUSTOMER": customer, "ANALYST": analyst, "SUPERVISOR": supervisor, "ADMIN": admin}

    # Throwaway accounts, so locking or revoking them does not touch the demo users.
    victims = []
    for _ in range(2):
        email = f"security.{uuid.uuid4().hex[:8]}@fraudcell.local"
        status, payload, _ = call("POST", "/api/v1/staff", admin, {
            "firstName": "Guvenlik", "lastName": "Testi", "email": email, "password": STAFF_PASSWORD,
            "role": "SUPERVISOR", "specialties": [], "regions": ["MARMARA"], "assignmentEnabled": False})
        check(f"create throwaway staff {email}", status == 201, payload)
        victims.append(email)

    role_matrix(tokens)
    idor(tokens)
    jwt_manipulation(customer)
    sql_injection(tokens)
    xss(admin)
    audit_of_403(customer, admin)
    refresh_token_reuse(victims[0])
    account_lockout(victims[1])
    otp_attempt_limit()
    rate_limits()

    print(f"\n{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
