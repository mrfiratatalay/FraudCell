# FraudCell documentation

I'm Fırat Atalay, and these documents are in my voice. We were a team of two: I was the captain, and my teammate was
Ayşe Mandıralı. FraudCell was built for the "FraudCell" case at the Turkcell CodeNight 2026 All-Star final. After the
event, I finished the system on my own; [01-story.md](01-story.md) separates what was built that night from what came
after.

Türkçe sürüm: [../README.md](../README.md)

## Reading paths

| For | Time | Read in order |
|---|---|---|
| Recruiters and non-technical readers | 5 min | [01 Story](01-story.md) → [02 Demo tour](02-demo-tour.md) |
| Engineers | 15 min | [03 Architecture](03-architecture.md) → [05 Domain rules](05-domain-rules.md) → [11 Problems I solved](11-problems-i-solved.md) |
| Quick review before an interview | 10 min | [11 Problems I solved](11-problems-i-solved.md) → [12 FAQ and limits](12-faq-and-limits.md) |
| Running it locally | 5 min | [10 Running and API](10-running-and-api.md) |

## Files

| No | File | Contents |
|---|---|---|
| 01 | [Story](01-story.md) | How it started, the team, my rules, before and after |
| 02 | [Demo tour](02-demo-tour.md) | A five-minute tour with all four roles; demo vs. the real system |
| 03 | [Architecture](03-architecture.md) | Services, events, the journey of one transaction |
| 04 | [Database](04-database.md) | A database per service, tables, outbox and inbox |
| 05 | [Domain rules](05-domain-rules.md) | Risk bands, the case state machine, SLA, points |
| 06 | [Security](06-security.md) | Identity, authorization, attack checks, known gaps |
| 07 | [AI](07-ai.md) | Models, data, metrics, the feedback loop |
| 08 | [Frontend and design](08-frontend-and-design.md) | React architecture, design language, demo mode |
| 09 | [Deployment strategy](09-deployment-strategy.md) | A free live demo, Docker and CI |
| 10 | [Running and API](10-running-and-api.md) | One-command setup, environment variables, curl examples |
| 11 | [Problems I solved](11-problems-i-solved.md) | Problem → solution → why |
| 12 | [FAQ and limits](12-faq-and-limits.md) | Likely interview questions, known limits, roadmap |

Also:

- [CASE-CHECKLIST.md](../CASE-CHECKLIST.md): the case requirements, item by item (in Turkish).
- [EVENTS.md](../../BACKEND/EVENTS.md): the event catalogue.
- [MODEL_CARD.md](../../BACKEND/src/Ai/fraudcell-ai/MODEL_CARD.md): the model card.

The design documents written on the hackathon night (about 36k lines) were removed from the repository. The repository
as it stood that night is kept in the `allstar-final-2026-07-23` tag.
