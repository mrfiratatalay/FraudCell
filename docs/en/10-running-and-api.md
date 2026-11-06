# 10. Running and API

## One-command setup

All you need is Docker (Desktop or Engine) with Compose v2. No .NET, Python or Node install is needed; the AI model is
trained while the image builds.

```bash
git clone https://github.com/mrfiratatalay/FraudCell.git
cd FraudCell
make up        # macOS / Linux
# Windows: scripts\start-fraudcell.bat
```

Without make:

```bash
cd BACKEND
cp .env.example .env
docker compose up -d --build
```

The first start takes a few minutes while images build. Once the services are healthy, `demo-seed` creates the demo
staff.

- App: http://127.0.0.1:8080
- Health: http://127.0.0.1:8080/health/ready

| Command | What it does |
|---|---|
| `make demo` | Checks the case's mandatory demo flow end to end |
| `make demo-ai-down` | Stops the AI and checks transactions are still recorded |
| `make resilience` | Stops each container in turn and checks the system recovers |
| `make security` | Tries the jury's attacks (sign-ins are throttled for a minute afterwards) |
| `make down` / `make reset` | Stop / delete all data |

## Demo users (local only)

| Role | Sign-in | Password |
|---|---|---|
| Administrator | `admin@fraudcell.local` | `ChangeMe123!` |
| Supervisor | `supervisor@fraudcell.local` | `Demo1234!` |
| Analyst (stolen card) | `analyst.kart@fraudcell.local` | `Demo1234!` |
| Analyst (account takeover) | `analyst.hesap@fraudcell.local` | `Demo1234!` |
| Analyst (money laundering) | `analyst.aklama@fraudcell.local` | `Demo1234!` |
| Analyst (suspicious behaviour) | `analyst.davranis@fraudcell.local` | `Demo1234!` |
| Customer | Any `5xxxxxxxxx` number | OTP `1234` |

## Environment variables

All of them are in [BACKEND/.env.example](../../BACKEND/.env.example), with comments:

| Variable | Purpose |
|---|---|
| `*_DB_PASSWORD`, `POSTGRES_ADMIN_PASSWORD` | Role passwords of the four databases |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | The message broker |
| `AI_INTERNAL_API_TOKEN` | The AI's internal maintenance endpoints |
| `GEMINI_API_KEY` | Optional; without it explanations come from a template |
| `SEED_ADMIN_*`, `DEMO_STAFF_PASSWORD` | Local demo accounts |
| `CASE_CLOSURE_DELAY` | How long after a decision a case closes (48 hours by default) |

## API

- Every endpoint is under `/api/v1`, behind the gateway: `http://127.0.0.1:8080/api/v1/...`.
- OpenAPI files: [BACKEND/contracts/openapi](../../BACKEND/contracts/openapi/). The frontend's types are generated from
  them, and CI checks for drift.
- Events: [EVENTS.md](../../BACKEND/EVENTS.md).

### Staff sign-in

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/auth/staff/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"supervisor@fraudcell.local","password":"Demo1234!"}'
# {"success":true,"data":{"accessToken":"eyJ...","accessTokenExpiresAt":"...","user":{...}},...}
TOKEN=eyJ...
```

### List cases

```bash
curl -s "http://127.0.0.1:8080/api/v1/cases?status=ATANDI&limit=5" -H "Authorization: Bearer $TOKEN"
```

### Assign a case (with an ETag)

```bash
curl -si http://127.0.0.1:8080/api/v1/cases/$CASE_ID -H "Authorization: Bearer $TOKEN" | grep -i etag
# ETag: "4"
curl -s -X PUT http://127.0.0.1:8080/api/v1/cases/$CASE_ID/assignment \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'If-Match: "4"' \
  -d '{"analystId":"'$ANALYST_ID'","reason":"Specialty match"}'
```

Sending the same request again with the old version returns 412:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RESOURCE_VERSION_MISMATCH",
    "message": "Kaynak başka bir kullanıcı veya işlem tarafından güncellendi.",
    "details": { "expectedVersion": 4, "currentVersion": 5 }
  },
  "meta": { "traceId": "01M6...", "pagination": null, "generatedAt": null }
}
```

### Customer transaction (with an Idempotency-Key)

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/transactions \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"amount":50000,"currency":"TRY","transactionType":"TRANSFER",
       "recipient":{"reference":"TR330006100519786457841326"},
       "device":{"fingerprint":"new-device"},
       "location":{"city":"New York","countryCode":"US"},
       "occurredAt":"2026-11-06T02:10:00+03:00"}'
```

## Running the tests

| What | Command |
|---|---|
| .NET | `cd BACKEND && dotnet test` (Docker must be running for Testcontainers) |
| AI | `cd BACKEND/src/Ai/fraudcell-ai && uv run pytest -q` |
| Frontend | `cd FRONTEND/app && npm test && npm run typecheck` |
| Browser | With the system up: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npx playwright test --project=desktop-chrome` |
| Frontend demo | `cd FRONTEND/app && npm run dev` (demo mode by default) |
