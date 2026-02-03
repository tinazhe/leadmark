# Supabase Setup Guide for LeadMarka

## Step-by-Step Setup

### Step 1: Create Supabase Account & Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** (Sign up with email or GitHub)
3. Click **"New Project"**
4. Fill in:
   - **Name**: `leadmarka-crm` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., `South Africa (Johannesburg)` for Zimbabwe)
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to be ready

---

### Step 2: Create Database Tables

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the ENTIRE SQL below and paste it into the editor
4. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter)

```sql
-- LeadMarka Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, but we add profile data)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    business_name TEXT,
    timezone TEXT DEFAULT 'Africa/Harare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Leads table
CREATE TABLE public.leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'interested', 'follow-up', 'won', 'lost')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Leads policies
CREATE POLICY "Users can view own leads" 
    ON public.leads FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own leads" 
    ON public.leads FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads" 
    ON public.leads FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads" 
    ON public.leads FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for faster searches
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_status ON public.leads(status);

-- Follow-ups table
CREATE TABLE public.follow_ups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    follow_up_date DATE NOT NULL,
    follow_up_time TIME NOT NULL,
    note TEXT CHECK (LENGTH(note) <= 140),
    completed BOOLEAN DEFAULT FALSE,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Follow-ups policies
CREATE POLICY "Users can view own follow-ups" 
    ON public.follow_ups FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own follow-ups" 
    ON public.follow_ups FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow-ups" 
    ON public.follow_ups FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own follow-ups" 
    ON public.follow_ups FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_follow_ups_user_id ON public.follow_ups(user_id);
CREATE INDEX idx_follow_ups_lead_id ON public.follow_ups(lead_id);
CREATE INDEX idx_follow_ups_date ON public.follow_ups(follow_up_date);
CREATE INDEX idx_follow_ups_completed ON public.follow_ups(completed);

-- Notes table
CREATE TABLE public.notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Notes policies
CREATE POLICY "Users can view own notes" 
    ON public.notes FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes" 
    ON public.notes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" 
    ON public.notes FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" 
    ON public.notes FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_notes_lead_id ON public.notes(lead_id);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON public.follow_ups 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Success message
SELECT 'LeadMarka database schema created successfully!' as status;
```

5. You should see "Success. No rows returned" - that's correct!

---

### Step 3: Configure Authentication

1. In left sidebar, click **"Authentication"**
2. Click **"Providers"** tab
3. Make sure **Email** provider is enabled (it should be by default)
4. (Optional) Configure settings:
   - Click **"Settings"** under Authentication
   - Set **Site URL** to your frontend URL (e.g., `http://localhost:3000` for local dev)
   - Under **Email Templates**, you can customize the confirmation email

---

### Step 4: Get Your API Keys

1. Click **"Project Settings"** (gear icon) in left sidebar
2. Click **"API"** in the submenu
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`)
   - **Project API keys**:
     - `anon` public (starts with `eyJ...`)
     - `service_role` secret (starts with `eyJ...`)

⚠️ **IMPORTANT**: The `service_role` key is like a master password - keep it secret! Never commit it to git.

---

### Step 5: Update Backend Environment Variables

Create your `.env` file in the backend folder:

```bash
cd /Users/yuri/Documents/LeadMaka/leadmarka-crm/backend
cp .env.example .env
```

Edit the `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-url.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# JWT Secret (generate a random string, at least 32 characters)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long

# Email Configuration (Resend - sign up at https://resend.com)
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=noreply@yourdomain.com

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

---

### Step 6: Test the Connection

1. Start your backend:
```bash
cd backend
npm install
npm run dev
```

2. Test the health endpoint:
```bash
curl http://localhost:3001/api/health
```

You should see: `{"status":"ok","timestamp":"..."}`

3. Test registration:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "businessName": "Test Business"
  }'
```

If you get a JSON response with a token, Supabase is working!

---

## Understanding Row Level Security (RLS)

RLS ensures users can only see their own data. Here's what we set up:

### How it works:
- Every table has `user_id` column
- Policies check `auth.uid() = user_id` 
- Users can only CRUD their own records
- Even if someone hacks the frontend, they can't access other users' data

### Tables protected:
- ✅ `profiles` - User can only see/update own profile
- ✅ `leads` - User can only see/update own leads
- ✅ `follow_ups` - User can only see/update own follow-ups
- ✅ `notes` - User can only see/update own notes

---

## Troubleshooting

### "Error: Invalid API key"
- Check you copied the full key (no extra spaces)
- Ensure you're using `service_role` key for backend

### "relation 'profiles' does not exist"
- Run the SQL schema again in the SQL Editor
- Make sure you're connected to the right project

### "new row violates row-level security policy"
- RLS is working! The app is trying to insert without proper user context
- Make sure your JWT token is valid and being sent in requests

### "Failed to send email"
- You need to set up Resend for email notifications
- Get API key from https://resend.com

---

## Next Steps

1. ✅ Supabase project created
2. ✅ Database schema created
3. ✅ RLS policies configured
4. ✅ API keys copied
5. ✅ Backend .env configured
6. ⏭️ Set up Resend for email (optional but recommended)
7. ⏭️ Deploy to production

See `DEPLOYMENT.md` for full deployment instructions.

---

**Your database is ready! Start the backend and frontend to test.**
