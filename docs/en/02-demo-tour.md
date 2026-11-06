# 02. Demo tour (5 minutes)

No technical knowledge needed. Open the live demo: the sign-in page has four role cards, each signs you in with one click
and no password. **Demoyu sıfırla** (reset demo) at the bottom right starts everything over. The interface is in
Turkish.

## Four roles, one story

The demo imitates a day in the real system: cases opened a few hours ago, one with a breached SLA, one waiting for the
customer's answer, and some closed and rated. Dates are computed relative to today every time it opens.

### 1. Customer: Ahmet Yılmaz

1. The home page shows a yellow banner: one transaction is waiting for his answer, an 18,750 TRY transfer from London.
2. **Yanıtla** (answer) → **Ben yapmadım** (not me) → **Yanıtı gönder** (send). The transaction is put on hold.
3. **İşlemler** (transactions) shows the outcome of each one: completed, in review, approved or blocked.
4. Open the blocked 42,000 TRY transaction. Next to the receipt is its progress: received → scored → reviewed by an
   analyst → blocked. At the bottom he can rate the process with 1–5 stars.
5. Try **Yeni işlem** (new transaction) with a large transfer abroad. The score rises and the case goes to an analyst.

### 2. Analyst: Deniz Kaya (stolen-card specialist)

1. In **Vakalarım** (my cases), the riskiest and most urgent case is on top. The SLA column counts down live.
2. Open the critical 50,000 TRY case from New York. The risk score is drawn against the 0.40 and 0.90 thresholds, with
   the AI's reasons next to it ("first time seen device, 10× the usual amount…").
3. The decision panel on the right always shows one next step: start review → ask the customer → or write a note and
   approve / block.
4. **Profilim** (my profile) shows the point history, level bar and badges. Blocking a fraud the customer confirmed earns
   the "First Catch" badge.

### 3. Supervisor: Murat Demir

1. **Panel** opens with "cases needing action", breached SLAs on top.
2. The strip at the top shows open cases, urgent SLAs, SLA compliance, critical risk and AI–analyst agreement. All are
   computed from the demo data, none are typed in.
3. **Atama Kuyruğu** (assignment queue): cases whose type the AI couldn't determine and cases waiting for analyst
   capacity. Open one and assign it; a reason is required.
4. On a case, the supervisor can correct the AI: change the risk level or the fraud type.
5. **Liderlik**: daily and weekly leaderboard.

### 4. Administrator: Selin Aydın

1. **Personel** (staff): role, specialty, region and whether they can take cases. Add a new analyst, then assign them a
   case as the supervisor.
2. **Denetim** (audit): sign-ins, assignments, decisions and denied requests (403) are recorded.

## Demo vs. the real system

| Topic | Live demo | Real system (`docker compose up`) |
|---|---|---|
| Server | None; a Mock Service Worker in the browser answers requests | 6 services, 4 Postgres, RabbitMQ |
| Data | Kept in this browser (localStorage) | Each service's own database |
| AI | A small rule set imitates the score | Trained scikit-learn models |
| Live notifications | None (no badge toast) | Instant, over SSE |
| Case closing | 20 s after the decision | 48 hours (configurable) |
| Screen code | Same | Same |

The demo answers the same contract at the transport layer, so the screen code is identical in both modes, and the live
build doesn't include any demo code. Details: [08 Frontend and design](08-frontend-and-design.md#demo-mode).
