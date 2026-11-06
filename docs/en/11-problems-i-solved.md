# 11. Problems I solved

Each story follows the same order: the problem, the fix, why, and where it lives in the code.

## 1. It didn't start on a clean machine

- **Problem:** A fresh clone didn't start, for two reasons:
  - The Postgres init script wasn't executable ("Permission denied").
  - The AI model files were in `.gitignore`, and the Dockerfile didn't train.
- **Fix:**
  - I made the script executable in git.
  - I trained the model from the committed data during the Docker build.
  - I added a CI job that runs `docker compose up` on a clean machine on every PR and walks the demo flow.
- **Why:** "Works on my machine" proves nothing. The jury, or an interviewer, will open the repo on theirs.

## 2. A transaction must not be lost when the AI is down

- **Problem:** The case requires the payment flow to keep working when the AI service fails.
- **Fix:**
  - The transaction is always saved, and its event goes to the outbox.
  - [AssessmentWatchdogWorker](../../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/BackgroundJobs/AssessmentWatchdogWorker.cs)
    marks a transaction `TIMED_OUT` after 5 seconds without a result and opens an "unknown"-risk case in the manual
    queue.
- **Why:** Silently treating a possibly risky transaction as "low risk" was the worst option. Leaving it unknown and
  putting a person in front of it is safer.
- **Proof:** CI's `demo.py ai-down` step stops the AI and tests this on every PR.

## 3. Healthy AI answers were timing out

- **Problem:** Even healthy traffic ended up in the manual queue. Compose polled every outbox every 2 seconds, and the AI
  deadline was also 2 seconds. `transaction.created` often left the outbox after the deadline had already passed.
- **Fix:** I set the outbox poll to 500 ms and the AI deadline to 5 seconds
  ([AssessmentOptions.cs](../../BACKEND/src/Services/Transaction/FraudCell.Transaction.Service/Common/AssessmentOptions.cs)).
  The round trip (outbox → AI → the AI's outbox → consumer) takes about 1–1.5 seconds; 5 seconds leaves room for cold
  starts.
- **Why:** A timeout is a safety net, not part of the normal path. I sized it from the real length of the chain.

## 4. The point rule pushed analysts to block everything

- **Problem:** Every block earned +15 "confirmed fraud" points, so wrong blocks were rewarded too.
- **Fix:**
  - First, a red test that caught it.
  - Then I tied the rule to the customer's answer: block + "it wasn't me" gives +15, block + "it was me" gives −8
    ([PointRuleEngine.cs](../../BACKEND/src/Services/Gamification/FraudCell.Gamification.Service/Common/PointRuleEngine.cs)).
- **Why:** In this case, the only source that knows whether a decision was right is the customer. Gamification that
  rewards the wrong behaviour does harm.

## 5. The badge came one decision late

- **Problem:** "First Catch" arrived on the second correct block, not the first (an off-by-one).
- **Fix:** The current decision now counts when badge thresholds are checked.
- **How I found it:** In the live demo, the analyst's badge count stayed at 0 after a correct block. I wrote a
  Testcontainers test that reproduced it, then fixed it. Today the browser test also waits for the badge toast.

## 6. One database, boundaries in name only

- **Problem:** Four services shared one Postgres and one key file.
- **Fix:**
  - Each service got its own Postgres and private network.
  - Other services' data arrives through event-fed projections.
  - The signing key stays in Identity, published through JWKS.
- **Why:** A schema change in one service shouldn't break the others, and the private key should live in one place.
- **Trade-off:** Eventual consistency. The analyst's state is checked once more at assignment time.

## 7. Live notifications lived inside the gateway

- **Problem:** SSE connections lived in the gateway. Restarting the gateway dropped every live connection, and the
  gateway was doing more than routing.
- **Fix:**
  - A separate notification service listens to RabbitMQ and pushes events to the browser over SSE.
  - The browser opens the stream with a short-lived, single-use ticket, so the token never goes into a URL.
- **Why:** One responsibility per service, and no tokens in logs.

## 8. Two supervisors assign the same case at once

- **Problem:** The last write won, and the first assignment vanished silently (a lost update).
- **Fix:**
  - Every record got a `version` column.
  - `GET` returns an ETag and writes require `If-Match`; a stale version gets 412.
  - Two writes in the same instant are caught by EF Core's concurrency token with 409.
- **Why:** In a fraud operation, overwriting someone's decision without knowing is unacceptable.

## 9. Customers could read the leaderboard

- **Problem:** A customer token could reach the endpoints that return staff points and badges.
- **Fix:**
  - I closed the gamification endpoints to everyone but staff.
  - I wrote every attack the jury would try into [security.py](../../scripts/security.py) and wired it into CI
    (96 checks).
- **Why:** Rather than fixing bugs one at a time, an automated test keeps the whole class of bug from coming back.

## 10. A stolen refresh token

- **Problem:** A stolen refresh token would let an attacker extend a session forever.
- **Fix:**
  - The token changes on every refresh (rotation).
  - If a used token shows up again, all of the user's sessions end (reuse detection).
- **Why:** We can't tell the real user from the attacker, so the safe move is to sign both out.

## 11. Night transactions were measured wrong

- **Problem:** The container ran in UTC, so a 02:00 transaction in Istanbul reached the model as 23:00.
- **Fix:** The hour and night features are computed explicitly in Istanbul time, pinned with a test.
- **Why:** "Night transaction" is one of the strongest fraud signals. If it's computed wrong, the model quietly gets
  worse.

## 12. The UI looked like a template

- **Problem:** The screens were stacks of cards, empty header cards and marketing copy. The analyst's real job, making a
  decision, got lost on the page.
- **Fix:**
  - I rebuilt the screens like a case-management tool: dense tables, a sticky decision panel, a dashboard that opens with
    "cases needing action".
  - Customers see the outcome of a transaction instead of a risk level.
  - A Playwright test that takes one case through all four roles runs in CI.
- **Why:** This is an operations tool. It looks good when it shows the right work at first glance.
