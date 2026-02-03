# LeadMarka Setup Flow

## 🚀 Getting Started (Choose Your Path)

### Path 1: Quick Setup (Recommended for beginners)
```
┌─────────────────────────────────────────────────────────────┐
│  1. Run Interactive Setup Script                             │
│     cd leadmarka-crm                                        │
│     ./setup-env.sh                                          │
│     → Enter Supabase credentials when prompted              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Start Backend                                            │
│     cd backend && npm install && npm run dev                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Start Frontend                                           │
│     cd frontend && npm install && npm start                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                        🎉 DONE!
```

### Path 2: Manual Setup (For understanding each step)
```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Create Supabase Project                             │
│  ├─ Go to https://supabase.com                               │
│  ├─ Click "New Project"                                      │
│  ├─ Name: leadmarka-crm                                     │
│  └─ Region: South Africa (Johannesburg)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Setup Database                                      │
│  ├─ Click "SQL Editor"                                       │
│  ├─ Open database/schema.sql                                 │
│  ├─ Copy SQL contents                                        │
│  └─ Paste & Run in SQL Editor                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Get API Keys                                        │
│  ├─ Project Settings → API                                   │
│  ├─ Copy: Project URL                                        │
│  ├─ Copy: service_role key (secret!)                        │
│  └─ Copy: anon key                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Configure .env                                      │
│  ├─ cd backend                                               │
│  ├─ cp .env.example .env                                    │
│  └─ Edit .env with your API keys                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Start Development                                   │
│  ├─ Terminal 1: cd backend && npm install && npm run dev   │
│  └─ Terminal 2: cd frontend && npm install && npm start    │
└─────────────────────────────────────────────────────────────┘
                              ↓
                        🎉 DONE!
```

---

## 📋 Complete File Reference

### Documentation
```
leadmarka-crm/
├── README.md                 ← Start here
├── SUPABASE_SETUP.md         ← Detailed Supabase tutorial
├── SUPABASE_CHECKLIST.md     ← Quick setup checklist
├── DEPLOYMENT.md             ← Production deployment
├── PRD.md                    ← Product requirements
└── SETUP_FLOW.md            ← This file
```

### Configuration Files
```
backend/
├── .env.example             ← Template for environment variables
└── .env                     ← Your actual secrets (git-ignored)

frontend/
└── .env                     ← Frontend API URL
```

### Setup Scripts
```
setup-env.sh                 ← Interactive setup wizard (make it executable)
```

---

## 🔧 Environment Variables Explained

### Backend (.env)
```bash
# Supabase (from Project Settings > API)
SUPABASE_URL=https://xxxxx.supabase.co          # Your project URL
SUPABASE_SERVICE_KEY=eyJ...                     # Secret master key ⚠️
SUPABASE_ANON_KEY=eyJ...                        # Public key

# Security (generate random string)
JWT_SECRET=your-random-secret-32-chars-min      # For signing tokens

# Email (optional, from https://resend.com)
RESEND_API_KEY=re_...                           # For email notifications
FROM_EMAIL=noreply@yourdomain.com              # Sender address

# App Config
PORT=3001                                       # Backend port
FRONTEND_URL=http://localhost:3000             # For password reset links
```

### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:3001/api     # Backend URL
```

---

## 🗄️ Database Schema Overview

```sql
┌─────────────────┐
│    profiles     │  ← User profile data
├─────────────────┤
│ id (PK)         │
│ full_name       │
│ business_name   │
│ timezone        │
└─────────────────┘
         │
         │ has many
         ▼
┌─────────────────┐
│     leads       │  ← Contact information
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ name            │
│ phone_number    │
│ status          │
└─────────────────┘
         │
         │ has many
         ▼
┌─────────────────┐     ┌─────────────────┐
│   follow_ups    │     │     notes       │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ lead_id (FK)    │     │ lead_id (FK)    │
│ user_id (FK)    │     │ user_id (FK)    │
│ follow_up_date  │     │ content         │
│ follow_up_time  │     │ created_at      │
│ completed       │     └─────────────────┘
└─────────────────┘
```

**Security**: All tables have Row Level Security (RLS) - users can only access their own data.

---

## ✅ Testing Your Setup

### 1. Backend Health Check
```bash
curl http://localhost:3001/api/health

# Expected response:
{"status":"ok","timestamp":"2024-..."}
```

### 2. Test Registration
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'

# Expected: JSON with token and user object
```

### 3. Verify Database
In Supabase Dashboard → Table Editor:
- [ ] Check `profiles` table has new row
- [ ] Check `auth.users` has new user

### 4. Frontend Test
- Open http://localhost:3000
- [ ] Register form works
- [ ] Login form works
- [ ] Can add a lead
- [ ] Can set a follow-up

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "relation does not exist" | Run SQL schema again in Supabase SQL Editor |
| "Invalid API key" | Check keys are copied fully, no extra spaces |
| "CORS error" | Update FRONTEND_URL in backend .env |
| "Cannot connect to database" | Check Supabase project is active (not paused) |
| "Emails not sending" | Check Resend API key and sender domain verification |

---

## 📝 Checklist for Production

Before deploying to production:

- [ ] Supabase project on Pro plan (for uptime SLA)
- [ ] Resend domain verified (for email deliverability)
- [ ] Backend .env uses production FRONTEND_URL
- [ ] JWT_SECRET is cryptographically random (32+ chars)
- [ ] Service Role Key kept secret (never in frontend!)
- [ ] Database backups enabled in Supabase
- [ ] SSL/HTTPS configured

---

## 🎯 Next Steps After Setup

1. ✅ **Setup complete**
2. 🧪 **Test the app** - Add a lead, set follow-up
3. 📧 **Setup Resend** - For email notifications (optional)
4. 🚀 **Deploy** - See DEPLOYMENT.md for hosting options
5. 📱 **Test on mobile** - The app is mobile-first!

---

**Need help?** Check the detailed guides:
- `SUPABASE_CHECKLIST.md` - Quick reference
- `SUPABASE_SETUP.md` - Step-by-step tutorial
- `DEPLOYMENT.md` - Production deployment
