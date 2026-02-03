# Supabase Quick Setup Checklist

## ⏱️ Time Required: ~10 minutes

### Step 1: Create Project (2 min)
- [ ] Go to https://supabase.com
- [ ] Sign up / Log in
- [ ] Click "New Project"
- [ ] Name: `leadmarka-crm`
- [ ] Region: `South Africa (Johannesburg)` (closest to Zimbabwe)
- [ ] Create project

### Step 2: Create Database Tables (3 min)
- [ ] Click "SQL Editor" in left sidebar
- [ ] Click "New query"
- [ ] Open `database/schema.sql` from this repo
- [ ] Copy ALL the SQL
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] ✅ Done when you see "Success"

### Step 3: Get API Keys (2 min)
- [ ] Click ⚙️ "Project Settings" in left sidebar
- [ ] Click "API" submenu
- [ ] Copy **Project URL** (save to notes)
- [ ] Copy **service_role key** (save to notes - keep secret!)
- [ ] Copy **anon key** (save to notes)

### Step 4: Configure Environment (3 min)

**Option A: Use the setup script (Recommended)**
```bash
cd leadmarka-crm
./setup-env.sh
# Follow the prompts and paste your API keys
```

**Option B: Manual setup**
```bash
cd backend
cp .env.example .env
# Edit .env file and paste your API keys
```

### Step 5: Test Connection
```bash
cd backend
npm install
npm run dev

# In another terminal:
curl http://localhost:3001/api/health
# Should return: {"status":"ok"}
```

---

## 🔑 API Keys Location in Supabase Dashboard

```
Project Settings
└── API
    ├── Project URL: https://xxxx.supabase.co
    ├── Project API keys
    │   ├── anon (public): eyJhbG...
    │   └── service_role (secret): eyJhbG... ⚠️ KEEP SECRET
```

---

## 🗄️ Database Tables Created

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (name, business, timezone) |
| `leads` | Contact information & status |
| `follow_ups` | Scheduled reminders |
| `notes` | Text notes on leads |

---

## ⚠️ Important Security Notes

1. **Never commit `.env` to git** - it contains secrets
2. **Service Role Key** = Master password - never expose publicly
3. **Row Level Security (RLS)** is enabled - users can only access own data
4. **Keep database password safe** - needed for direct DB access

---

## 🆘 Troubleshooting

**Error: "relation 'profiles' does not exist"**
→ Run the SQL schema again in SQL Editor

**Error: "Invalid API key"**  
→ Check you copied the full key without spaces

**Error: "new row violates row-level security policy"**
→ This is actually good! RLS is working. Check your auth token.

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Backend starts without errors (`npm run dev`)
- [ ] Health endpoint works (`curl http://localhost:3001/api/health`)
- [ ] Can register a new user via API
- [ ] Frontend loads (`npm start`)
- [ ] Can login on frontend

---

## 📚 Next Steps

1. ✅ Supabase setup complete
2. ⏭️ Set up Resend for email (optional)
3. ⏭️ Start development
4. ⏭️ Deploy to production

**See full details in: `SUPABASE_SETUP.md`**
