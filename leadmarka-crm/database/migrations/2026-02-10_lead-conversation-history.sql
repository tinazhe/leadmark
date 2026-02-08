-- Phase 4: Conversation history fields
-- Safe to run on existing projects. Run in Supabase SQL Editor.
-- Adds: last_message_summary

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_message_summary TEXT;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT chk_leads_last_message_summary_len
    CHECK (last_message_summary IS NULL OR LENGTH(last_message_summary) <= 500);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
