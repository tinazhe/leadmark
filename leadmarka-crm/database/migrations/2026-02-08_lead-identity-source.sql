-- Phase 1: Identity and Source fields
-- Safe to run on existing projects. Run in Supabase SQL Editor.
-- Adds: email, company_name, source, referrer_name

-- Identity
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Source (where the lead came from)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referrer_name TEXT;

-- Index for email search
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email) WHERE email IS NOT NULL;

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source) WHERE source IS NOT NULL;
