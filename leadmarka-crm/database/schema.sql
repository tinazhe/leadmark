-- LeadMarka Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, but we add profile data)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    business_name TEXT,
    timezone TEXT DEFAULT 'Africa/Harare',
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_lead_minutes INTEGER DEFAULT 5,
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
    conversation_label TEXT CHECK (LENGTH(conversation_label) <= 60),
    last_whatsapp_contact_at TIMESTAMP WITH TIME ZONE,
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
CREATE INDEX idx_leads_name ON public.leads USING gin(to_tsvector('english', name));
CREATE INDEX idx_leads_last_whatsapp_contact_at ON public.leads(last_whatsapp_contact_at DESC);

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
    notification_claimed_at TIMESTAMP WITH TIME ZONE,
    notified_at TIMESTAMP WITH TIME ZONE,
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
CREATE INDEX idx_notes_created_at ON public.notes(created_at DESC);

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
