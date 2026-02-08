# Run Team Inbox migrations in Supabase SQL Editor

## Who gets Team Inbox?

- **Everyone** (new and existing users) when the backend env `TEAM_INBOX_ENABLED=true`. There is no per-user opt-in; it’s a global feature flag.
- **No signup option:** You don’t “create” a team at signup. Every account is a workspace (one owner). When the flag is on, the **Inbox** tab appears in the app. Invite members from **Settings → Team**; once you have at least one other member, the inbox shows shared leads and assignments.
- **Existing users:** Run the two migrations below so existing users get a row in `workspace_members`. Without that, the app still works (middleware falls back), but running the backfill keeps data consistent.

---

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **SQL Editor** in the left sidebar.
3. Run the migrations in order:

---

## Step 1: Foundation (tables + columns)

Click **New query**, paste the contents of:

**`database/migrations/2026-02-05_team-inbox-foundation.sql`**

Then click **Run** (or Cmd/Ctrl+Enter).

---

## Step 2: Backfill (existing users + leads)

Click **New query**, paste the contents of:

**`database/migrations/2026-02-05_backfill-workspace-members.sql`**

Then click **Run**.

---

Done. Existing users will have a self-membership row in `workspace_members`, and existing leads will have `assigned_user_id` set to their creator.

**Enable Team Inbox:** Set `TEAM_INBOX_ENABLED=true` in your backend env, redeploy the backend, then redeploy the frontend. Users must **log out and log back in** (or hard-refresh after the frontend loads user from `/auth/me`) so the app receives `teamInboxEnabled` and the **Inbox** tab appears in the bottom nav.

---

## Optional: Lead Identity & Source

To add email, company name, source, and referrer fields to leads, run:

**`database/migrations/2026-02-08_lead-identity-source.sql`**

This adds optional columns for marketing attribution and B2B context.

---

## Optional: Lead Stage Expansion (7 stages)

To expand the pipeline from 5 to 7 stages (New, Contacted, Quoted, Follow-up, Negotiating, Won, Lost), run:

**`database/migrations/2026-02-09_lead-stages-expansion.sql`**

This migrates existing `interested` leads to `contacted` and updates the status constraint.

---

## Optional: Conversation History (last message summary)

To add a `last_message_summary` field on leads for quick conversation context, run:

**`database/migrations/2026-02-10_lead-conversation-history.sql`**

This adds a nullable text field (max 500 chars) to store the latest message summary.

---

## Optional: Lead Intent (product, budget, urgency)

To capture product/service interest, variant specs, budget range, and urgency, run:

**`database/migrations/2026-02-10_lead-intent-fields.sql`**

This adds optional intent columns and validates urgency values (`now`, `soon`, `browsing`).
