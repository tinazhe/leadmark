# Leadmarka — OpenCode Rules

## Core Principle
Build **only** what is explicitly required.
If a feature is not written in the PRD, it does not exist.

No assumptions.
No "nice-to-haves".
No future-proofing.

---

## Product Context
This project is **Leadmarka** — a mobile-first web app for tracking WhatsApp leads and follow-ups.

Leadmarka:
- Organizes sales **around WhatsApp**
- Does **not** replace WhatsApp
- Exists to ensure **no lead is forgotten**

Daily usability > feature richness.

---

## Non-Negotiable Rules

### 1. Scope Discipline
- Do NOT add features beyond the PRD
- Do NOT suggest improvements unless explicitly asked
- Do NOT add placeholders for future features
- Do NOT refactor for scale or extensibility

Build the MVP. Stop.

---

### 2. WhatsApp Boundary
- WhatsApp is **external**
- Use `wa.me` links only
- No message syncing
- No WhatsApp API
- No automation

Any attempt to integrate WhatsApp directly is a violation.

---

### 3. MVP Feature Lock
The application includes **only**:
- Email/password authentication
- Manual lead creation
- Fixed lead statuses
- Follow-up reminders
- Notes per lead
- Today screen (due + overdue follow-ups)
- Single-user accounts

Anything else is out of scope.

---

### 4. UX Rules
- Mobile-first always
- Light mode only
- Large tap targets
- Fast load on slow connections
- Functional UI > visual polish

Default screen is **Today**.

---

### 5. Language Rules (Strict)
Use these exact terms:
- "Leads" (not contacts)
- "Follow-ups" (not tasks)
- "Today" (not dashboard)
- "Notes" (not history)

Do not invent or rename concepts.

---

### 6. Data & Architecture
- Simple schemas
- No premature abstraction
- No unnecessary layers
- Clear frontend/backend separation
- Predictable, boring code

Readability beats cleverness.

---

### 7. AI Behavior Rules (If Applicable)
- Never invent requirements
- Never guess business logic
- Ask for clarification **only if blocked**
- Prefer explicit instruction over inference

Silence is better than guessing.

---

### 8. Error Handling
- Fail clearly
- Show user-friendly errors
- Do not hide failures
- Do not over-engineer edge cases

This is an MVP, not a bank.

---

### 9. Performance Rules
- Optimize for perceived speed
- Avoid heavy libraries
- Avoid large bundles
- Avoid unnecessary re-renders

Zimbabwean network conditions are the baseline.

---

### 10. Hard Prohibitions
Do NOT add:
- Analytics dashboards
- AI features
- Payments or invoicing
- Teams or roles
- Custom pipelines
- File uploads
- Voice notes
- Native mobile apps
- Permanent free tiers

If unsure, do nothing and wait.

---

## Definition of Done
A build is complete when a user can:
1. Add a lead
2. Set a follow-up
3. See it on Today
4. Receive a reminder
5. Click WhatsApp
6. Close a deal they would have forgotten

If this works reliably, the product is done.

---

## Final Rule
**Restraint is a feature.**
Build less. Ship faster. Validate reality.
