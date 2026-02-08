-- Add receipt email tracking for billing transactions
-- Safe to run on existing projects.

ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS receipt_emailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_email_id TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_tx_receipt_emailed_at
  ON public.billing_transactions(receipt_emailed_at);
