# 06. Security

## Identity

| Topic | Decision | Code |
|---|---|---|
| Customer sign-in | Phone number + 4-digit one-time code (OTP). In the demo environment the code is `1234` and shown on screen | [OtpService.cs](../../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/OtpService.cs) |
| Staff sign-in | Email + password; 5 failed attempts lock the account for 15 minutes | [StaffLoginEndpoint.cs](../../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Features/Auth/StaffLogin/StaffLoginEndpoint.cs) |
| Password storage | Argon2id instead of the default PBKDF2 | [Argon2idPasswordHasher.cs](../../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/Argon2idPasswordHasher.cs) |
| Access token | RS256-signed JWT, 15 minutes; kept in memory only, never in localStorage | |
| Refresh token | 7 days, HttpOnly cookie, rotated on every use | [RefreshTokenService.cs](../../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/RefreshTokenService.cs) |
| Stolen refresh token | Reusing an old token ends **all** of the user's sessions | same file |
| Key distribution | Identity publishes its public key as JWKS; other services validate tokens with it | [JwksEndpoints.cs](../../BACKEND/src/Services/Identity/FraudCell.Identity.Service/Security/JwksEndpoints.cs) |

**Why JWKS?** In the hackathon version the signing key was shared with every service through a volume. The private key
went to more places than it needed to, and rotating it was hard. Now the private key stays in Identity, and the others
fetch the public key from JWKS.

## Authorization

- The gateway does the coarse check: is the token valid, does the role fit the route?
- Each service does the fine check itself: is this case assigned to this analyst, does this transaction belong to this
  customer?
- Role-based menus in the UI are only presentation, not security; the real checks are in the backend.

| Role | Can see |
|---|---|
| Customer | Only their own transactions, verifications and sessions |
| Analyst | Only cases assigned to them and those cases' transactions |
| Supervisor | All cases, the queue, assignment, AI corrections, dashboard, leaderboard |
| Administrator | Everything a supervisor sees, plus staff management and the audit log |

## Audit

- Sign-ins, lockouts, staff changes, assignments and decisions are written to `audit_logs`.
- Every denied request (403) is recorded too. Each service does it through its own outbox
  ([AuthorizationDeniedAuditMiddleware.cs](../../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Security/AuthorizationDeniedAuditMiddleware.cs)),
  so the record can't get lost on the way.

## The jury's list became a script

The case listed the attacks the jury would try. I put them all into [scripts/security.py](../../scripts/security.py).
In CI it runs **96 checks** against the real system on every PR:

| Attempt | Expected |
|---|---|
| Request without a token | 401 |
| Request with the wrong role (role matrix) | 403 |
| Another customer's transaction, another analyst's case (IDOR) | 403 or 404 |
| Tampered signature, changed role or expired JWT | 401 |
| SQL injection input | 400 / 401, nothing leaks |
| Notes and names with XSS | Returned escaped |
| Brute force | Lockout and rate limit |
| OTP attempt limit | Blocked |
| A used refresh token | All sessions end |

## Rate limits and headers

- The gateway limits staff sign-in and the OTP endpoints to 30 requests per minute per IP and path.
- Every response carries `Content-Security-Policy` (`script-src 'self'` only), `X-Frame-Options: DENY`, `nosniff` and
  `Referrer-Policy: no-referrer`. Because inline scripts are not allowed, even the theme snippet loads from its own file.

## Error contract

Every service returns the same envelope
([ExceptionHandlingMiddleware.cs](../../BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Api/ExceptionHandlingMiddleware.cs)):

```json
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_CREDENTIALS", "message": "E-posta veya şifre hatalı.", "details": null },
  "meta": { "traceId": "01M6...", "pagination": null, "generatedAt": null }
}
```

An unknown user and a wrong password get the same answer, so emails can't be enumerated. The `traceId` matches the logs.

## Secrets

- No real secrets are in the repository; the `.env.example` files hold sample values only.
- The RSA key is generated inside Identity on first start and kept in a volume.
- The demo users' passwords are for the local `Development` environment only.

## Known gaps

| Gap | Status |
|---|---|
| The OTP limit is per IP only; the same phone number can be tried from different IPs | Next |
| Creating a staff member (user + profile + event) isn't one database transaction | Next |
| No TLS termination; HTTP locally | Needs a reverse proxy or a cloud load balancer |
| No real SMS | Out of the case's scope; the OTP is shown on screen |
