# 09. Deployment strategy

## Problem

I'm a new graduate without a budget to keep the project online. FraudCell needs seven application containers, four
Postgres instances and RabbitMQ. On free tiers the backend sleeps and the database expires; a recruiter who clicks the
link sees an empty page.

## Solution: two channels

| Channel | For | What |
|---|---|---|
| Live demo | Recruiters, non-technical readers | A backend-free demo on Vercel; one-click sign-in for all four roles |
| Code and system | Engineers | The code on GitHub, these documents, and the real system started with one command |

**Why?** The demo is free and always on. An engineer can run the real system on their own machine with one command,
and can see in every PR how CI brings it up on a clean machine.

**Trade-off:** The demo doesn't show the real message queue or the real model. I say so in the demo and in
[02 Demo tour](02-demo-tour.md#demo-vs-the-real-system).

## Vercel (demo)

- [vercel.json](../../FRONTEND/app/vercel.json) builds with `npm run build:demo` and rewrites deep links to
  `index.html`, so reloading any route works.
- The Vercel project's root directory is `FRONTEND/app`.
- It costs nothing: no server, no database.

## Docker (the real system)

- Each .NET service builds with a multi-stage Dockerfile; the runtime image carries only the ASP.NET runtime and runs as
  a non-root user.
- Base image versions are pinned (no "latest"), so the same commit always gives the same image.
- The AI image trains the model during the build and leaves the training dependencies out of the final image (700 MB).
- web serves the SPA with the unprivileged nginx image.

## CI: five jobs on every PR

[.github/workflows/ci.yml](../../.github/workflows/ci.yml):

| Job | What it does |
|---|---|
| dotnet | Build (warnings are errors) and 51 tests, with real Postgres and RabbitMQ through Testcontainers |
| ai | 49 pytest tests |
| frontend | Checks the types generated from OpenAPI are current, 11 unit tests, type check, build |
| compose-config | Validates `docker compose config` |
| demo-e2e | `docker compose up --build` on a clean machine, then the demo flow (47 checks), the flow with the AI down, stopping each container in turn, Playwright through all four roles, and 96 security checks |

Only PRs with all five jobs green were merged into `main`.

## Why not Kubernetes?

The case and the budget call for a single-machine setup. Compose covers it with health checks, start order and private
networks. If it ever needs more machines, the services are already separate images with separate databases, so the move
doesn't require code changes.
