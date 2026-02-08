# LeadMarka CRM

**A mobile-first WhatsApp-First CRM for Zimbabwean SMEs.**

*Never forget a WhatsApp lead again.*

## What is LeadMarka?

LeadMarka is a lightweight CRM built specifically for small businesses in Zimbabwe that use WhatsApp as their primary sales channel. It helps you:

- Track leads and their status
- Set follow-up reminders with email notifications
- Keep notes on every conversation
- See what's urgent today at a glance

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) in the repo root. To auto-update it from commits:

```bash
# Add new changelog entries from conventional commits (feat:, fix:, etc.)
npm run changelog

# Release: bump version, update changelog, create git tag, commit
npm run release
```

Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat: add X`, `fix: resolve Y`). Tag your releases (`git tag v1.0.0`) so the changelog knows what's new.

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)

### 1. Setup Supabase (< 5 min)

**Option A: Interactive Script**
```bash
# Run the setup wizard
cd leadmarka-crm
./setup-env.sh
```

**Option B: Manual Setup**
```bash
# 1. Create Supabase project at https://supabase.com
# 2. Run SQL from database/schema.sql in SQL Editor
# 3. Get API keys from Project Settings > API

# 4. Setup backend environment
cd backend
cp .env.example .env
# Edit .env with your API keys
```

📖 **Detailed guides:**
- Quick checklist: `SUPABASE_CHECKLIST.md`
- Full tutorial: `SUPABASE_SETUP.md`

### 2. Start Backend
```bash
cd backend
npm install
npm run dev
# Server running on http://localhost:3001
```

### 2b. Start Reminder Worker (for email reminders)
```bash
cd backend
npm run worker
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm start
# App opens at http://localhost:3000
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase and Resend credentials
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000`

## Core Features

### MVP Features (Implemented)
✅ **Authentication** - Email/password signup, login, password reset
✅ **Lead Management** - Create, edit, delete leads with auto-formatted phone numbers
✅ **Status Tracking** - 5 fixed statuses (New, Interested, Follow-up, Won, Lost)
✅ **Follow-up Reminders** - Schedule reminders with email notifications
✅ **Notes System** - Unlimited text notes per lead, editable, timestamped
✅ **Today Dashboard** - Default screen showing today's and overdue follow-ups
✅ **WhatsApp Integration** - One-click "Chat on WhatsApp" via wa.me links

### Explicitly Out of Scope
❌ WhatsApp API integration
❌ Message syncing
❌ AI features
❌ Payments/invoicing
❌ Multi-user teams
❌ Analytics dashboards
❌ Mobile native apps
❌ File uploads

## Project Structure

```
leadmarka-crm/
├── frontend/              # React SPA (mobile-first)
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API calls
│   │   └── contexts/     # React contexts
│   └── public/
├── backend/              # Node.js API
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── services/        # Business logic
│   └── config/          # Config files
├── database/            # Supabase schema
│   └── schema.sql
├── PRD.md              # Product Requirements Document
└── DEPLOYMENT.md       # Deployment guide
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, React Router |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL + Auth) |
| Email | Resend |
| Phone Formatting | libphonenumber-js |

## Key Design Decisions

1. **Mobile-First**: All UI optimized for mobile screens with large touch targets
2. **Today Dashboard Default**: Opening the app shows what needs attention NOW
3. **No Feature Creep**: Strictly limited to MVP scope
4. **Simple Stack**: Boring, reliable technologies that just work
5. **No WhatsApp API**: Uses wa.me links to avoid API complexity and cost

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Sign in |
| `/api/auth/forgot-password` | POST | Request reset |
| `/api/auth/reset-password` | POST | Reset password |
| `/api/auth/me` | GET | Get current user |
| `/api/leads` | GET | List leads |
| `/api/leads` | POST | Create lead |
| `/api/leads/:id` | GET/PUT/DELETE | Lead CRUD |
| `/api/followups` | POST | Create follow-up |
| `/api/followups/:id/complete` | PATCH | Mark complete |
| `/api/notes` | POST | Create note |
| `/api/dashboard/today` | GET | Today's dashboard |

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
JWT_SECRET=random_string_min_32_chars
RESEND_API_KEY=your_resend_key
FROM_EMAIL=info@update.leadmarka.co.zw
FRONTEND_URL=http://localhost:3000
PORT=3001
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:3001/api
```

## Testing the App

1. **Register** a new account
2. **Add a lead** with phone number (e.g., +263771234567)
3. **Set a follow-up** for 1 minute from now
4. **Add a note** to the lead
5. **Click WhatsApp** button to open chat
6. **Wait for email** reminder

## Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

Quick options:
- **Frontend**: Vercel, Netlify
- **Backend**: Vercel (API + cron), Railway, Heroku
- **Database**: Supabase (cloud)

## Success Metrics

The MVP is successful when:
- Users log in daily
- Users actively set follow-up reminders
- Users report recovered or closed deals
- Users say "I can't go back to pure WhatsApp"

## License

Proprietary - LeadMarka

## Support

Built for Zimbabwean SMEs by developers who understand WhatsApp-driven sales.

**Questions?** Check the PRD.md for detailed requirements.

---

*Built with care. Designed for speed. Made for WhatsApp sales.*
