# LeadMarka Engineering Rules (Cursor)

## 0) Prime Directive

- **NEVER** ship changes that can risk data loss, cross-tenant access, or secret exposure.
- Do not break production.
- Prefer correctness, auditability, and reversibility over speed.
- If a request is ambiguous, choose the safer implementation (deny by default).
- Prefer the smallest possible change that solves the problem.
- If unsure, don't refactor. Add code in a contained way.

## 1) Authentication & Authorization

- Authentication is required for **ALL** endpoints except explicit public routes.
- Authorization checks **MUST** happen server-side for every request.
- Never trust client-provided `tenantId`, `role`, or `permissions`.

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
- All schema changes **MUST** be versioned.
- Migrations **MUST** be:
  - idempotent (safe to re-run)
  - reversible where possible
  - backward compatible
- If reversal is not possible, implement a data-copy migration strategy.
- Never drop columns/tables in prod without a deprecation window.
- Use additive changes first:
  1. add columns/tables
  2. backfill
  3. switch code
  4. only later remove old fields (after a stable period)

### 6a) Backups & Restore (Operational Safety)

- Implement daily automated backups for prod data.
- Backups must include:
  - database
  - object storage (if used)
- Add a documented restore procedure.
- Provide a "restore drill" script that restores into staging (never prod).

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

- Protect routes and API endpoints with auth checks.
- Validate all inputs server-side (not just client-side).

### 9a) Secrets & Credentials (No leaks)

- **NEVER** place secrets in:
  - source code
  - frontend bundles
  - logs
  - error messages
  - docs examples
- All secrets **MUST** be loaded via environment variables or a secrets manager.
- Add a pre-commit / CI check to block commits containing:
  - API keys
  - private keys
  - tokens
  - service account JSON

### 9b) Logging rules

- Never log: access tokens, refresh tokens, OTPs, passwords, message contents, customer PII.
- Mask/redact fields: phone, email, device identifiers.

### 9c) Input Validation & Data Integrity

- Validate all incoming data at boundaries:
  - API request body
  - query params
  - webhooks
- Use schema validation (e.g., Zod / Joi / Yup).
- Normalize and sanitize:
  - phone numbers to E.164
  - IDs to UUID format (if used)
  - dates to ISO 8601

## 10) Observability: Errors, Logs, Alerts

- Add error tracking (Sentry or equivalent) for backend + frontend.
- Add structured logs (JSON preferred).
- Add alert triggers for:
  - spike in 5xx errors
  - auth failures spike
  - permission denied spike
  - webhook failures
  - background job failures
  - unusual delete volume

### Required metadata (every log line)

- `env` (dev/staging/prod)
- `requestId`
- `tenantId` (if available)
- `userId` (if available)

## 11) WhatsApp / External Integrations Safety

- Verify webhook signatures where supported.
- Store only necessary message data; avoid storing full message content unless needed.
- If storing messages:
  - encrypt at rest if feasible
  - strict access controls (tenant + role)
- Implement retry logic with exponential backoff for outbound calls.
- Make inbound webhook processing idempotent (dedupe by messageId).

## 12) Code Review Output Format (Cursor Must Follow)

For every change, provide:

- **Summary** of what changed (bullets)
- **Files touched** + why
- **Risk level:** Low / Medium / High
- **Test evidence:** what was run
- **Manual verification checklist** (critical flow items)

### 12a) Cursor Behavior Rules (how you must generate code)

- Before writing code, state:
  - what files you will change
  - what risks exist (tenant, auth, migration)
  - what tests you will add
- Prefer small, incremental commits.
- Use centralized helpers:
  - `getTenantId()`
  - `requireAuth()`
  - `requireRole()`
  - `scopedQuery(tenantId)`
- Never implement tenant filtering in the UI only.
- Never introduce a new dependency without justification.

### 12b) Done Definition (PR acceptance)

A change is **NOT** "done" unless:

- tenant isolation is enforced
- authz checks exist server-side
- secrets are not exposed
- errors are monitored
- tests cover core flows
- staging smoke test passes

## 13) Deployment Rules

- Never deploy on Friday evening.
- Deploy to staging first.
- After deploy, run the Critical Flows.
- If any critical flow fails: rollback immediately.

## 14) "Stop and Ask" Conditions

Cursor must **STOP and ask for approval** if:

- it needs to refactor shared code
- it wants to change DB schema
- it wants to change authentication
- it wants to change routing/navigation
- it wants to add major dependencies
