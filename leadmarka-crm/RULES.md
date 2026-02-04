# LeadMarka Engineering Rules (Cursor)

## 0) Prime Directive

- Do not break production.
- Prefer the smallest possible change that solves the problem.
- If unsure, don't refactor. Add code in a contained way.

## 1)

*(Reserved)*

## 2) Change Scope Rules

- No broad refactors (renames, folder reshuffles, "cleanup") unless explicitly requested.
- Do not change existing behavior unless the ticket says so.
- Touch as few files as possible.
- If editing shared modules, add tests that prove old behavior still holds.

## 3) Backwards Compatibility

- Existing APIs, DB schema, and UI flows must remain stable.
- If you must change an API:
  - keep the old endpoint/shape working
  - add a new version or optional fields
- Never remove fields without a deprecation plan.

## 4) Testing Is Mandatory

- Every feature/fix must include tests that cover:
  - the new behavior
  - the critical old behavior near it (regression test)
- Minimum test set before merge:
  - Unit tests for core logic
  - Integration/API tests for key endpoints
  - UI smoke test (even basic Playwright/Cypress "can load + click + save")
- If no test framework exists yet:
  - Create a basic one first (don't ship features without it).

## 5) Regression Protection (Non-Negotiable)

Maintain and run a **Critical User Flows** suite on every PR:

**Critical Flows List**

- Sign up / sign in
- Create lead
- Edit lead
- Tag lead
- Set follow-up reminder
- View "Today" / dashboard list
- Search leads
- Logout

Any change touching these must:

- include a test OR an updated smoke script
- show evidence it was manually verified (short checklist)

## 6) Database & Migrations

- No destructive migrations in production without a rollback plan.
- All migrations must be:
  - backward compatible
  - idempotent where possible
- Use additive changes first:
  1. add columns/tables
  2. backfill
  3. switch code
  4. only later remove old fields (after a stable period)

## 7) Feature Flags for Risky Changes

- Anything that could affect user flow must be behind a feature flag:
  - new onboarding
  - new dashboard layout
  - new follow-up logic
  - imports/integrations
- Default flags to OFF in production until verified.

## 8) Performance & Reliability Guardrails

- No new dependency unless necessary and justified.
- Don't increase bundle size heavily; prefer native solutions.
- Avoid long-running queries; add indexes if needed.
- Add basic monitoring logs around new critical logic.

## 9) Security & Data Rules

- Never log sensitive data (phone numbers, message content, tokens).
- Validate all inputs server-side (not just client-side).
- Protect routes and API endpoints with auth checks.
- Secrets must stay in env vars—never in code.

## 10) Code Review Output Format (Cursor Must Follow)

For every change, provide:

- **Summary** of what changed (bullets)
- **Files touched** + why
- **Risk level:** Low / Medium / High
- **Test evidence:** what was run
- **Manual verification checklist** (critical flow items)

## 11) Deployment Rules

- Never deploy on Friday evening.
- Deploy to staging first.
- After deploy, run the Critical Flows.
- If any critical flow fails: rollback immediately.

## 12) "Stop and Ask" Conditions

Cursor must **STOP and ask for approval** if:

- it needs to refactor shared code
- it wants to change DB schema
- it wants to change authentication
- it wants to change routing/navigation
- it wants to add major dependencies
