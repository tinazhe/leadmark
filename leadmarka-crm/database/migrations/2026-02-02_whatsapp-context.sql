-- WhatsApp context enhancements (no WhatsApp API)
-- Safe to run on existing projects.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS conversation_label TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_whatsapp_contact_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_conversation_label_length_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_conversation_label_length_check
      CHECK (conversation_label IS NULL OR LENGTH(conversation_label) <= 60);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_last_whatsapp_contact_at
  ON public.leads (last_whatsapp_contact_at DESC);

