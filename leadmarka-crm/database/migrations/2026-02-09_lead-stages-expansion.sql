-- Phase 2: Stage expansion (7 stages)
-- Safe to run on existing projects. Run in Supabase SQL Editor.
-- Maps: interested -> contacted. Adds: quoted, negotiating.
-- New stages: new, contacted, quoted, follow-up, negotiating, won, lost

-- 1. Drop old CHECK constraint FIRST (it blocks 'contacted' until we add the new one)
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'leads'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', conname);
  END IF;
END $$;

-- 2. Migrate existing data (interested -> contacted)
UPDATE public.leads
SET status = 'contacted'
WHERE status = 'interested';

-- 3. Add new CHECK constraint with 7 stages
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'quoted', 'follow-up', 'negotiating', 'won', 'lost'));
