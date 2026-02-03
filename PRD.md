Product Requirements Document (PRD)

Product Name (Working): LeadMarka
Version: MVP v1.0
Market: Zimbabwe (SMEs, WhatsApp-driven sales)
Platform: Web App (Mobile-First)

---

1. Product Overview

1.1 Problem Statement

Small businesses in Zimbabwe conduct the majority of sales conversations on WhatsApp. These conversations are unstructured, leading to:

- Forgotten follow-ups
- Lost leads
- No visibility into sales progress
- Poor accountability

Existing CRMs are overbuilt, expensive, and misaligned with WhatsApp-centric workflows.

1.2 Solution

A lightweight, mobile-first web CRM that gives structure to WhatsApp sales conversations by:

- Tracking leads
- Assigning simple statuses
- Setting follow-up reminders
- Providing a daily action dashboard

This product does not replace WhatsApp. It organizes sales around it.

1.3 MVP Goal

Ensure no lead is forgotten and every WhatsApp conversation has a follow-up system.

---

2. Target Users

2.1 Primary User

- SME owner or solo operator
- Uses WhatsApp as the main sales channel
- Handles leads manually
- Operates in retail, services, or deal-based sales

2.2 Initial Focus Segments

- Electronics & phone shops
- Car dealers
- Salons & spas
- Real estate agents
- Event promoters

---

3. Success Metrics (MVP)

The MVP is successful if:

- Users log in daily
- Users actively set follow-up reminders
- Users report at least one recovered or closed deal
- Users express dependency ("I can't go back to pure WhatsApp")

---

4. Scope Definition

4.1 In Scope (MVP Only)

- Lead management
- Status tracking
- Follow-up reminders
- Notes
- Daily dashboard
- Single-user accounts

4.2 Explicitly Out of Scope (v1)

- WhatsApp API integration
- Message syncing
- AI features
- Payments & invoicing
- Multi-user teams
- Analytics dashboards
- Mobile apps
- File or voice uploads

---

5. Functional Requirements

5.1 Authentication & Account Management

- Email + password signup/login
- Password reset via email
- Basic account settings:
  - Full name
  - Business name
  - Timezone
  - Reminder preferences (enable/disable, lead-time minutes)

5.2 Lead / Contact Management

Features
- Create lead manually:
  - Name (required)
  - Phone number (required)
- Auto-format phone numbers (international format)
- Search leads by name or phone number
- One-click "Chat on WhatsApp" action

Rules
- No automatic contact syncing
- Leads are private to the account

5.3 Lead Status (Pipeline Lite)

Fixed statuses (non-customizable):
- New
- Interested
- Follow-up
- Won
- Lost

Behaviors
- One status per lead
- Status change in one tap
- Filter leads by status

5.4 Follow-Up Reminders

Core MVP Feature

Capabilities
- Set follow-up date and time per lead
- Optional short note (max 140 characters)
- Follow-ups appear on dashboard when due
- Overdue follow-ups clearly marked
- Reminder lead-time (default: 5 minutes before follow-up)

Notifications
- Email notification at reminder time (lead-time before follow-up)
- Daily summary email at 8:00 AM local time (optional; includes overdue + today)
- System dashboard reminder

5.5 Notes System

Features
- Add unlimited text notes per lead
- Notes are timestamped
- Editable notes
- Latest note preview shown in lead list

5.6 Daily Dashboard

Default landing screen

Displays only:
- Follow-ups due today
- Overdue follow-ups
- Quick WhatsApp chat buttons

Explicit exclusions
- No charts
- No revenue analytics
- No historical stats

---

6. UX / UI Requirements

6.1 Design Principles

- Mobile-first
- Low bandwidth friendly
- Fast load times
- Large touch targets
- Minimal UI clutter

6.2 Visual Style

- Light mode only
- Neutral colors
- Focus on readability and speed
- Functional > aesthetic

---

7. Technical Requirements (Suggested)

7.1 Frontend
- Angular or React
- Responsive layout
- PWA-ready (optional)

7.2 Backend
- Node.js
- Firebase or Supabase
- REST or simple RPC API

7.3 Notifications
- Email (mandatory)
- WhatsApp/SMS deferred to v2

---

8. Security & Data

- HTTPS only
- Encrypted passwords
- No third-party data sharing
- User data isolated per account

---

9. Monetization (Post-MVP)

- Subscription pricing (USD)
- Free trial (time-limited, not feature-limited)
- No permanent free tier

---

10. Risks & Constraints

- WhatsApp API limitations (intentionally avoided in MVP)
- Low tolerance for slow apps
- Users may resist "CRM" language → positioning must emphasize reminders and follow-ups

---

11. Release Criteria

The MVP is ready to launch when:

- Follow-ups reliably trigger reminders
- Dashboard loads under 2 seconds on mobile
- WhatsApp click-to-chat works flawlessly
- No feature creep beyond defined scope

---

12. Future (Explicitly Deferred)

- Team inbox
- WhatsApp Business API
- AI follow-up suggestions
- Payments & invoicing
- CRM analytics
- Mobile apps

---

One-Line Product Definition

"A simple system that ensures you never forget a WhatsApp lead again."
