-- Phase 3: Intent fields (product, budget, urgency)
-- Safe to run on existing projects. Run in Supabase SQL Editor.
-- Adds: product_or_service, variant_specs, budget_range, urgency

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS product_or_service TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS variant_specs TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS budget_range TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS urgency TEXT;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT chk_leads_urgency
    CHECK (urgency IS NULL OR urgency IN ('now', 'soon', 'browsing'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
