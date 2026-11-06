# 01. Story

## The case

At the Turkcell CodeNight 2026 All-Star final we were given the "FraudCell" case: a platform that catches fraud in digital
payments. It had to:

- Score every transaction with AI.
- Turn risky ones into cases for the right analyst.
- Track each case against an SLA.
- Ask the customer "was this you?" when needed.
- Keep analysts motivated with points, badges and a leaderboard.

There were four roles: customer, analyst, supervisor and administrator. The case document is in the repository:
[CodeNight_FINAL_FraudCell_Case.pdf](../../BACKEND/references/CodeNight_FINAL_FraudCell_Case.pdf).

## Team and roles

We were two people: me (Fırat Atalay) as captain, and my teammate Ayşe Mandıralı. We didn't place at the final; we
competed as All-Star finalists.

## Two periods

**The hackathon night (2026-07-22 17:45 → 2026-07-23 04:52, 16 commits).**

- **Ayşe:** Wrote the architecture documents, the first versions of the Identity and Transaction services, and the
  frontend's foundation.
- **Me:** Wired the services together, wrote the fallback that keeps a transaction from getting lost when the AI is down,
  finished the demo flows and redid the UI.

By the end of the night the system worked, but it didn't start on a clean machine and many rules were missing.

**After the event (November 2026, Parts 0–6).** I finished the project end to end so I could defend it on my CV. I wrote
a large part of the code together with AI (Claude Code), under rules I set myself. Every step went in as a separate PR,
and every PR was merged with green CI.

## My rules

1. **One command starts it.** `docker compose up` must work on a clean machine with no manual steps.
2. **Every claim has a test.** The case's mandatory flow runs from scratch in CI on every PR.
3. **Real service boundaries.** Each service has its own database; no service touches another's tables.
4. **Red test first, then the fix.** I caught each business-rule bug with a test before fixing it.
5. **Keep the night and the aftermath apart.** The hackathon state lives in a tag; everything after it arrives in small
   commits.

## Before / after

| Topic | End of the hackathon | Today |
|---|---|---|
| Clean-machine start | Failed: init script not executable, model files missing | `make up` or `docker compose up` |
| Databases | One Postgres, a shared key file | A Postgres per service on a private network, JWKS |
| Live notifications | Inside the gateway | A separate notification service (SSE) |
| Point rule | Every block earned +15 | +15 only when the customer said "not me" |
| Security | Customers could read the leaderboard | 96 attack checks run in CI on every PR |
| AI | Data not in the repo | Data and 120 Turkish scenarios in the repo, model card, feedback loop |
| Tests | 5 C# tests | 51 .NET, 49 Python, 11 unit, 2 browser tests + 47 demo and 96 security checks |
| CI | Red since July | 5 green jobs: .NET, AI, frontend, compose, end-to-end demo |
| UI | Card stacks, marketing copy | Case tables, a decision panel, light and dark themes |
| Docs | 36k lines of AI-generated plans | These 12 files, in Turkish and English |

Sources for the numbers: the latest CI run and [CASE-CHECKLIST.md](../CASE-CHECKLIST.md).
