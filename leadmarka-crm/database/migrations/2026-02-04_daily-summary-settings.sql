-- Daily summary and reminder settings (per-user)
-- Safe to run on existing projects. Ensures all profile columns exist.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_lead_minutes INTEGER DEFAULT 5;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_summary_time TEXT DEFAULT '08:00';

