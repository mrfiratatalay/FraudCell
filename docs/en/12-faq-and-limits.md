# 12. FAQ and limits

## Likely interview questions

**Why microservices? Wouldn't a monolith do at this scale?**
The case required the payment flow to survive an AI outage and components to fail and recover independently. In a
monolith, a slow AI would slow payments too. I know the price: distributed debugging and eventual consistency. I manage
it with outbox/inbox and the resilience test in CI.

**What happens without the outbox?**
The moment we saved data but failed to send the event, two services would drift apart: the transaction exists but the AI
never heard of it. Because the event is written in the same database transaction as the data, either both happen or
neither does.

**What if the same event arrives twice?**
RabbitMQ delivers at least once. Every consumer records event ids in `inbox_messages` and skips repeats. The point
ledger also has a uniqueness rule per event and rule.

**What if two analysts decide on the same case at once?**
A case is assigned to one analyst only (filtered unique index). For the same person in two tabs there is ETag/If-Match:
the second write gets 412.

**How good is the AI?**
On the test set at the 0.40 threshold: precision 0.72, recall 0.52. Few false alarms, but about half of the frauds slip
past the model. Lowering the threshold would catch more at the cost of more analyst work. Retraining on real data would
be the first job.

**Why not score with an LLM?**
The score must be explainable, reproducible and fast. The LLM only writes the explanation paragraph; the score and the
decision come from scikit-learn models. Without an LLM key, the system works the same.

**What is the ground truth?**
The customer's "it was me / it wasn't me" answer. Both analyst points and the model's accuracy metrics are computed from
it; unanswered cases are left out.

**How did you test security?**
I automated every attack on the jury's list in [security.py](../../scripts/security.py) (96 checks). It runs against the
real system on every PR.

**What was your part?**
We were two on the hackathon night, and I was the captain. That night Ayşe wrote the architecture documents, the first
versions of the Identity and Transaction services and the frontend's foundation. I did the integration, the flow that
works with the AI down, the demo flows and the UI. I did the post-event completion (Parts 0–6) on my own. I wrote a large
part of the code with AI (Claude Code), under rules I set myself. I read every change, verified it with tests and
merged it in small PRs.

**How do you own code written with AI?**
I set the rules: one-command start, a red test first for every business rule, no merge without green CI. I wrote each
PR description, and I checked every number in these documents against the code.

## Known limits

| Limit | Effect | What I'd do |
|---|---|---|
| Model recall is 0.52 | About half of the frauds never become cases | Tune the threshold, retrain on real data, add features for suspicious behaviour |
| Synthetic training data | We don't know the real-world distribution | Real, anonymised data |
| OTP limit per IP only | Unlimited tries on one number from different IPs | A per-number counter |
| Staff creation isn't one DB transaction | A user can exist without a profile | One transaction, or outbox-based compensation |
| No real SMS | The OTP is shown on screen | An SMS provider |
| No HTTPS | HTTP locally | A reverse proxy or a cloud load balancer |
| One machine (Compose) | No horizontal scaling | Services are already separate; moving to Kubernetes needs no code changes |
| No SSE or real model in the live demo | The demo imitates the rules | A deliberate choice (see [09](09-deployment-strategy.md)) |

## Roadmap

1. A per-number OTP limit, and staff creation in one transaction.
2. Threshold tuning and new features for the suspicious-behaviour type.
3. Cross-service tracing with OpenTelemetry (today `traceId` and `correlationId` are in the logs).
4. A 2-minute video of the real system running.
