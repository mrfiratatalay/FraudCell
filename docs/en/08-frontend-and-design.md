# 08. Frontend and design

## Stack

| Layer | Choice |
|---|---|
| Framework | React 19, TypeScript 5.9, Vite 8 |
| Routing | TanStack Router; filters and pagination live in the URL and can be shared |
| Server state | TanStack Query: caching, retries, invalidation |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS 4, Radix UI primitives |
| Tests | Vitest (unit), Playwright (browser) |
| Demo | Mock Service Worker (MSW) 2 |

Folders: `routes/` holds screens, `features/` holds per-domain API calls and components, `shared/` holds the design
system and the API client ([FRONTEND/app/src](../../FRONTEND/app/src/)).

## Server state in one place

There is no global store. Everything from the server lives in the TanStack Query cache. Live events don't create a
second store; they only invalidate the matching query. When `case.decision.made` arrives, for example, the case list is
refetched. Two copies of the same data can't drift apart.

- **The access token stays in memory.** On reload, the HttpOnly refresh cookie gets a new one.
- **SSE opens with a short-lived ticket.** The token never goes into a URL, so it can't leak into logs or history.
- **ETags.** The case screen keeps the version and sends `If-Match` on every write; on 412 the user is warned.

## Design language

**Problem:** The first version was stacks of cards, an empty header card on top of every page and marketing copy. To
look at a case, an analyst had to get past a ring gauge that took half the screen.

**Solution:** I rebuilt the screens like a case-management tool:

- **Analyst inbox:** a dense table with risk, transaction, amount, status and a live SLA on one line, the riskiest and
  most urgent case first ([CaseTable.tsx](../../FRONTEND/app/src/features/cases/CaseTable.tsx)).
- **Case workspace:** a facts strip on top, the risk meter with its thresholds and the AI's reasons in the middle, the
  case history below, and on the right a sticky decision panel that shows one next step at a time
  ([CaseParts.tsx](../../FRONTEND/app/src/features/cases/CaseParts.tsx)).
- **Supervisor dashboard:** it opens with "what needs doing now": the cases needing action first, then workload and the
  model.
- **Customer:** a banking-app layout. The customer sees the **outcome** of a transaction (completed, in review, approved,
  blocked), not the model's risk level.

**Colour:** Turkcell yellow (#FFC900) is used only for the primary action and the active menu item, Turkcell navy for the
sidebar and the dark theme. That is a deliberate nod to the event; the logo and the brand name are not in the UI.

**Risk colours** are ordered: low green, medium deep amber, high orange, critical red. The levels also differ in
lightness, not just hue, and are always shown with text, so they work for colour-blind users too. The medium amber is
kept darker than the primary yellow on purpose.

## Theme and accessibility

- Light and dark themes come from the same CSS variables. The theme is set before first paint, so there is no flash.
  The CSP doesn't allow inline scripts, so that snippet lives in its own file
  ([theme-init.js](../../FRONTEND/app/public/theme-init.js)).
- Visible focus rings for keyboard users, `aria-label` on icon buttons, real `<button>` and `<a>` elements.
- Animations stop when `prefers-reduced-motion` is set.
- Tables fold into two-line rows on narrow screens. The breakpoint follows the table's own width (container queries),
  not the screen's, so the same table works full width and inside a dashboard column.

## Demo mode

In a build made with `VITE_API_MODE=mock`, a Service Worker in the browser answers the requests
([src/demo](../../FRONTEND/app/src/demo/)):

- **Same contract:** The screen code is identical to the real build; only the transport changes. The demo handlers return
  the `contract.ts` types.
- **Same rules:** Risk bands, SLA windows, the state machine, the point table and the ETag checks match the backend.
- **Fresh data:** The seed is computed relative to today and stored in localStorage; the badge at the bottom right resets
  it.
- **Doesn't leak into production:** In a live build, `import.meta.env.VITE_API_MODE !== 'live'` is `false` at build time,
  so the demo files are never bundled. I checked this in the build output.

## Tests

- Unit: Vitest covers the event schema, the notification model and helpers (11 tests).
- Browser: [roles.spec.ts](../../FRONTEND/app/e2e/roles.spec.ts) takes one case through all four roles and runs in CI
  against the real system. [auth-responsive.spec.ts](../../FRONTEND/app/e2e/auth-responsive.spec.ts) checks that the
  sign-in page fits from 320 px up to desktop.
