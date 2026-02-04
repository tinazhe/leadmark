-- Add reminder-related columns to follow_ups if missing (e.g. DB created before schema had them).
-- Safe to run on existing projects. Run in Supabase SQL Editor.

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS notification_claimed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE;
