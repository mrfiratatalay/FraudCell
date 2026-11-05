"""FraudCell demo helper: seed demo staff and check the case's mandatory demo flow.

Standard library only, so it runs on any machine with Python 3.10+ and inside a
plain python container. Everything goes through the public gateway API.

    python3 scripts/demo.py seed      # create the demo staff accounts (idempotent)
    python3 scripts/demo.py smoke     # case 11.3 steps 2-6, exits 1 on any failure
    python3 scripts/demo.py ai-down   # step 7: run while ai-service is stopped
    python3 scripts/demo.py resilience  # stop each container in turn (needs docker)

Environment: FRAUDCELL_BASE_URL (default http://127.0.0.1:8080), SEED_ADMIN_EMAIL,
SEED_ADMIN_PASSWORD, DEMO_STAFF_PASSWORD.
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("FRAUDCELL_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@fraudcell.local")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
STAFF_PASSWORD = os.environ.get("DEMO_STAFF_PASSWORD", "Demo1234!")

ALL_REGIONS = ["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU", "YURT_DISI"]

# One analyst per fraud specialty, so the AI's specialty match is visible in the demo.
DEMO_ANALYSTS = {
    "CALINTI_KART": ("analyst.kart@fraudcell.local", "Kart", "Analisti"),
    "HESAP_ELE_GECIRME": ("analyst.hesap@fraudcell.local", "Hesap", "Analisti"),
    "PARA_AKLAMA": ("analyst.aklama@fraudcell.local", "Aklama", "Analisti"),
    "SUPHELI_DAVRANIS": ("analyst.davranis@fraudcell.local", "Davranis", "Analisti"),
}
SUPERVISOR_EMAIL = "supervisor@fraudcell.local"
COMPOSE = ["docker", "compose", "-f", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BACKEND", "docker-compose.yml")]
LEADERBOARD = "/api/v1/game/leaderboard?period=daily"

failures: list[str] = []


def call(method: str, path: str, token: str | None = None, body: object | None = None,
         headers: dict[str, str] | None = None) -> tuple[int, dict, dict]:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE_URL + path, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, _parse(response.read()), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, _parse(error.read()), dict(error.headers)


def _parse(raw: bytes) -> dict:
    try:
        parsed = json.loads(raw or b"{}")
        return parsed if isinstance(parsed, dict) else {"data": parsed}
    except json.JSONDecodeError:
        return {"raw": raw[:300].decode(errors="replace")}


def check(label: str, condition: bool, detail: object = None) -> bool:
    print(f"[{'PASS' if condition else 'FAIL'}] {label}")
    if not condition:
        failures.append(label)
        if detail is not None:
            print("       ", json.dumps(detail, ensure_ascii=False, default=str)[:600])
    return condition


def data_of(payload: dict) -> dict:
    data = payload.get("data")
    return data if isinstance(data, dict) else {}


def items_of(payload: dict) -> list[dict]:
    data = payload.get("data")
    if isinstance(data, dict):
        return data.get("items") or []
    return data if isinstance(data, list) else []


def wait_for_gateway(seconds: int = 300) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(BASE_URL + "/health/ready", timeout=5) as response:
                if response.read().decode().strip() == "Healthy":
                    return
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(3)
    sys.exit(f"Gateway at {BASE_URL} did not become healthy in {seconds}s.")


def staff_login(email: str, password: str, retry_seconds: int = 0) -> str | None:
    deadline = time.monotonic() + retry_seconds
    while True:
        status, payload, _ = call("POST", "/api/v1/auth/staff/login", body={"email": email, "password": password})
        token = data_of(payload).get("accessToken")
        if token or time.monotonic() >= deadline:
            check(f"staff login {email}", bool(token), payload)
            return token
        time.sleep(3)


def customer_login() -> str | None:
    gsm = f"5{random.randint(300000000, 599999999)}"
    _, payload, _ = call("POST", "/api/v1/auth/customer/otp/challenges",
                         body={"gsmNumber": gsm, "purpose": "CustomerRegister"})
    challenge_id = data_of(payload).get("challengeId")
    _, payload, _ = call("POST", "/api/v1/auth/customer/otp/verifications", body={
        "challengeId": challenge_id, "code": "1234",
        "customer": {"firstName": "Demo", "lastName": "Musteri", "email": None}})
    token = data_of(payload).get("accessToken")
    check(f"customer {gsm} registers with OTP 1234", bool(token), payload)
    return token


def last_night_utc() -> str:
    """01:30 UTC (04:30 in Istanbul): night in any time zone interpretation, never in the future."""
    now = datetime.now(timezone.utc)
    night = now.replace(hour=1, minute=30, second=0, microsecond=0)
    if night > now:
        night -= timedelta(days=1)
    return night.strftime("%Y-%m-%dT%H:%M:%SZ")


def create_high_risk_transaction(customer_token: str) -> str | None:
    body = {
        "amount": 50000, "currency": "TRY", "transactionType": "TRANSFER",
        "recipient": {"reference": f"TR{random.randint(10**20, 10**21)}"},
        "device": {"fingerprint": f"new-device-{uuid.uuid4().hex[:10]}"},
        "location": {"city": "Berlin", "countryCode": "DE"},
        "occurredAt": last_night_utc(),
    }
    status, payload, _ = call("POST", "/api/v1/transactions", customer_token, body,
                              {"Idempotency-Key": str(uuid.uuid4())})
    check("customer creates a night, abroad, 50.000 TRY transfer -> 201", status == 201, payload)
    return data_of(payload).get("transactionId")


def wait_for_assessment(customer_token: str, transaction_id: str, seconds: int = 30) -> dict:
    deadline = time.monotonic() + seconds
    transaction: dict = {}
    while time.monotonic() < deadline:
        _, payload, _ = call("GET", f"/api/v1/transactions/{transaction_id}", customer_token)
        transaction = data_of(payload)
        if (transaction.get("assessment") or {}).get("status") in ("COMPLETED", "TIMED_OUT", "FAILED"):
            break
        time.sleep(0.5)
    return transaction


def seed() -> None:
    wait_for_gateway()
    admin = staff_login(ADMIN_EMAIL, ADMIN_PASSWORD, retry_seconds=60)
    if not admin:
        sys.exit(1)

    accounts = [(email, first, last, "ANALYST", [specialty])
                for specialty, (email, first, last) in DEMO_ANALYSTS.items()]
    # Supervisors do not need a specialty, but the API still requires one (checklist 3.1-b).
    accounts.append((SUPERVISOR_EMAIL, "Demo", "Supervizor", "SUPERVISOR", ["SUPHELI_DAVRANIS"]))

    for email, first, last, role, specialties in accounts:
        status, payload, _ = call("POST", "/api/v1/staff", admin, {
            "firstName": first, "lastName": last, "email": email, "password": STAFF_PASSWORD,
            "role": role, "specialties": specialties, "regions": ALL_REGIONS,
            "assignmentEnabled": role == "ANALYST"})
        if status == 409:
            print(f"[SKIP] {email} already exists")
        else:
            check(f"create {role} {email}", status == 201, payload)

    sys.exit(1 if failures else 0)


def smoke() -> None:
    wait_for_gateway()
    # Right after `docker compose up` the demo-seed job may still be running. The
    # supervisor is the last account it creates, so once it can log in every
    # analyst exists; the pause lets their staff events reach the AI and
    # Transaction projections before the first transaction is scored.
    supervisor = staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD, retry_seconds=180)
    if not supervisor:
        sys.exit(1)
    time.sleep(5)

    customer = customer_login()
    transaction_id = create_high_risk_transaction(customer) if customer else None
    if not transaction_id:
        sys.exit(1)

    transaction = wait_for_assessment(customer, transaction_id)
    assessment = transaction.get("assessment") or {}
    print("        AI:", json.dumps({k: assessment.get(k) for k in ("riskScore", "riskLevel", "fraudType", "screeningDecision")}))
    check("AI assessment completed", assessment.get("status") == "COMPLETED", transaction)
    check("AI flags the transaction for review or block",
          assessment.get("screeningDecision") in ("INCELEME", "BLOK") and transaction.get("caseId"), assessment)

    fraud_type = assessment.get("fraudType")
    analyst_email = DEMO_ANALYSTS.get(fraud_type, (None,))[0]
    if not check(f"a demo analyst exists for fraud type {fraud_type}", analyst_email is not None):
        sys.exit(1)

    analyst = staff_login(analyst_email, STAFF_PASSWORD)
    case_id = transaction.get("caseId")

    assigned: list[dict] = []
    for _ in range(30):
        _, payload, _ = call("GET", "/api/v1/cases/assigned", analyst)
        assigned = items_of(payload)
        if any(item.get("caseId") == case_id for item in assigned):
            break
        time.sleep(1)
    check(f"case is assigned to the {fraud_type} specialist", any(item.get("caseId") == case_id for item in assigned),
          assigned)

    _, _, headers = call("GET", f"/api/v1/cases/{case_id}", analyst)
    status, payload, _ = call("POST", f"/api/v1/cases/{case_id}/review", analyst,
                              headers={"If-Match": headers.get("ETag", "")})
    check("analyst starts the review", status == 200, payload)

    _, _, headers = call("GET", f"/api/v1/cases/{case_id}", analyst)
    status, payload, _ = call("PATCH", f"/api/v1/cases/{case_id}/decision", analyst,
                              {"decision": "BLOCK", "note": "Yurt disi, yeni cihaz, gece: musteri profiline uymuyor."},
                              {"If-Match": headers.get("ETag", "")})
    check("analyst blocks the transaction with a decision note", status == 200, payload)

    analyst_id = None
    leaderboard: list[dict] = []
    for _ in range(20):
        _, payload, _ = call("GET", "/api/v1/auth/me", analyst)
        analyst_id = data_of(payload).get("id") or data_of(payload).get("userId")
        _, payload, _ = call("GET", "/api/v1/game/leaderboard?period=daily", supervisor)
        leaderboard = items_of(payload)
        if any(row.get("analystId") == analyst_id and row.get("points", 0) > 0 for row in leaderboard):
            break
        time.sleep(1)
    row = next((r for r in leaderboard if r.get("analystId") == analyst_id), None)
    print("        leaderboard row:", json.dumps(row, ensure_ascii=False))
    check("points reach the daily leaderboard", bool(row and row.get("points", 0) > 0), leaderboard)

    sys.exit(1 if failures else 0)


def ai_down() -> None:
    wait_for_gateway()
    customer = customer_login()
    transaction_id = create_high_risk_transaction(customer) if customer else None
    if not transaction_id:
        sys.exit(1)

    transaction = wait_for_assessment(customer, transaction_id, seconds=20)
    assessment = transaction.get("assessment") or {}
    check("transaction is kept and falls back to manual review (TIMED_OUT, INCELEME)",
          assessment.get("status") in ("TIMED_OUT", "FAILED") and assessment.get("riskLevel") is None, transaction)

    supervisor = staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD)
    _, payload, _ = call("GET", "/api/v1/cases/assignment-queue?queueType=MANUAL_QUEUE&limit=100", supervisor)
    queue = items_of(payload)
    check("its case waits in the supervisor's manual queue",
          any(item.get("caseId") == transaction.get("caseId") for item in queue), queue)

    sys.exit(1 if failures else 0)


@contextmanager
def outage(service: str) -> Iterator[None]:
    """Stop one container for the duration of the block, then start it and wait until it is healthy."""
    print(f"--- {service} stopped")
    subprocess.run([*COMPOSE, "stop", service], check=True, capture_output=True)
    try:
        yield
    finally:
        subprocess.run([*COMPOSE, "up", "-d", "--wait", "--wait-timeout", "300", "--no-deps", service],
                       check=True, capture_output=True)
        print(f"--- {service} running again")


def points_by_analyst(supervisor: str) -> dict[str, int]:
    return {row.get("analystId"): row.get("points", 0) for row in items_of(call("GET", LEADERBOARD, supervisor)[1])}


def block_case(analyst: str, case_id: str) -> int:
    """Wait until the case is assigned, start the review and block it; returns the decision's HTTP status."""
    for _ in range(30):
        if any(item.get("caseId") == case_id for item in items_of(call("GET", "/api/v1/cases/assigned", analyst)[1])):
            break
        time.sleep(1)
    _, _, headers = call("GET", f"/api/v1/cases/{case_id}", analyst)
    call("POST", f"/api/v1/cases/{case_id}/review", analyst, headers={"If-Match": headers.get("ETag", "")})
    _, _, headers = call("GET", f"/api/v1/cases/{case_id}", analyst)
    status, _, _ = call("PATCH", f"/api/v1/cases/{case_id}/decision", analyst,
                        {"decision": "BLOCK", "note": "Dayaniklilik testi: oyunlastirma kapaliyken verilen karar."},
                        {"If-Match": headers.get("ETag", "")})
    return status


def resilience() -> None:
    """Stop one container at a time; the rest must keep working and the stopped one must catch up.

    ai-service is covered by the ai-down command (case step 7).
    """
    wait_for_gateway()
    supervisor = staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD, retry_seconds=180)
    customer = customer_login()
    if not (supervisor and customer):
        sys.exit(1)
    # Each service downloads Identity's signing keys on its first authenticated request.
    call("GET", LEADERBOARD, supervisor)
    call("GET", "/api/v1/cases/assignment-queue?queueType=MANUAL_QUEUE&limit=1", supervisor)

    with outage("identity-service"):
        status, _, _ = call("GET", LEADERBOARD, supervisor)
        check(f"signed-in staff keep working (cached signing keys) -> {status}", status == 200)
        create_high_risk_transaction(customer)
        status, _, _ = call("POST", "/api/v1/auth/staff/login", body={"email": SUPERVISOR_EMAIL, "password": STAFF_PASSWORD})
        check(f"new logins fail fast with a gateway error -> {status}", status in (502, 503, 504))
    staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD, retry_seconds=60)

    points_before = points_by_analyst(supervisor)
    with outage("gamification-service"):
        # A new customer each time: the AI learns a customer's habits, so a
        # repeated "unusual" transfer from the same customer stops looking risky.
        fresh_customer = customer_login() or ""
        transaction_id = create_high_risk_transaction(fresh_customer)
        transaction = wait_for_assessment(fresh_customer, transaction_id) if transaction_id else {}
        analyst_email = DEMO_ANALYSTS.get((transaction.get("assessment") or {}).get("fraudType"), (None,))[0]
        analyst = staff_login(analyst_email, STAFF_PASSWORD) if analyst_email else None
        analyst_id = data_of(call("GET", "/api/v1/auth/me", analyst)[1]).get("id") if analyst else None
        status = block_case(analyst, transaction.get("caseId")) if analyst else None
        check(f"analyst still decides cases -> {status}", status == 200, transaction)
    for _ in range(30):
        if points_by_analyst(supervisor).get(analyst_id, 0) > points_before.get(analyst_id, 0):
            break
        time.sleep(1)
    check("points earned during the outage arrive after the restart",
          points_by_analyst(supervisor).get(analyst_id, 0) > points_before.get(analyst_id, 0))

    with outage("transaction-service"):
        status, _, _ = call("GET", LEADERBOARD, supervisor)
        check(f"leaderboard still works -> {status}", status == 200)
        staff_login(SUPERVISOR_EMAIL, STAFF_PASSWORD)
        status, _, _ = call("GET", "/api/v1/cases/assignment-queue?queueType=MANUAL_QUEUE&limit=1", supervisor)
        check(f"case API fails fast with a gateway error -> {status}", status in (502, 503, 504))
    create_high_risk_transaction(customer)

    with outage("notification-service"):
        fresh_customer = customer_login() or ""
        transaction_id = create_high_risk_transaction(fresh_customer)
        transaction = wait_for_assessment(fresh_customer, transaction_id) if transaction_id else {}
        check("cases are still opened without live notifications", bool(transaction.get("caseId")), transaction)
    status, _, _ = call("POST", "/api/v1/events/tickets", supervisor)
    check(f"live notification stream is available again -> {status}", status == 200)

    with outage("web"):
        status, _, _ = call("GET", LEADERBOARD, supervisor)
        check(f"the API works without the web container -> {status}", status == 200)
    status, _, _ = call("GET", "/")
    check(f"the web app is served again -> {status}", status == 200)

    with outage("rabbitmq"):
        transaction_id = create_high_risk_transaction(customer)
        transaction = wait_for_assessment(customer, transaction_id, seconds=20) if transaction_id else {}
        check("without the broker the transaction waits for manual review (TIMED_OUT)",
              (transaction.get("assessment") or {}).get("status") in ("TIMED_OUT", "FAILED"), transaction)
    scored = False
    deadline = time.monotonic() + 120
    while not scored and time.monotonic() < deadline:
        transaction_id = create_high_risk_transaction(customer)
        assessment = (wait_for_assessment(customer, transaction_id) if transaction_id else {}).get("assessment") or {}
        scored = assessment.get("status") == "COMPLETED"
        if not scored:
            time.sleep(5)
    check("after the broker is back, the AI scores new transactions again", scored)

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    commands = {"seed": seed, "smoke": smoke, "ai-down": ai_down, "resilience": resilience}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        sys.exit(f"usage: {sys.argv[0]} {{{'|'.join(commands)}}}")
    commands[sys.argv[1]]()
