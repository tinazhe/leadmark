-- LeadMarka Pro billing: workspace_subscriptions + billing_transactions
-- Run in Supabase SQL Editor. Safe to run on existing projects.

-- 1. Subscription state per workspace (one row per workspace owner)
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trialing',
  plan_name TEXT NOT NULL DEFAULT 'LeadMarka Pro',
  plan_amount NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  trial_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  grace_end_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 days'),
  current_period_end TIMESTAMPTZ,
  payer_phone TEXT,
  comped_until TIMESTAMPTZ,
  comped_reason TEXT,
  comped_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

-- Backend uses service_role key (bypasses RLS).
-- These policies exist as a safety net for direct client access.
DROP POLICY IF EXISTS "Owners can view own subscription" ON public.workspace_subscriptions;
CREATE POLICY "Owners can view own subscription"
  ON public.workspace_subscriptions FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Service role full access to subscriptions" ON public.workspace_subscriptions;
CREATE POLICY "Service role full access to subscriptions"
  ON public.workspace_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Billing transactions (payment attempts via Paynow)
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  paynow_reference TEXT,
  poll_url TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own transactions" ON public.billing_transactions;
CREATE POLICY "Owners can view own transactions"
  ON public.billing_transactions FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Service role full access to billing transactions" ON public.billing_transactions;
CREATE POLICY "Service role full access to billing transactions"
  ON public.billing_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_billing_tx_owner_id ON public.billing_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_reference ON public.billing_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_billing_tx_status ON public.billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_tx_created_at ON public.billing_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_sub_status ON public.workspace_subscriptions(status);


-- 3. Backfill: create trial subscription for all existing workspace owners
INSERT INTO public.workspace_subscriptions (owner_id, status, trial_start_at, trial_end_at, grace_end_at)
SELECT DISTINCT wm.owner_id, 'trialing', NOW(), NOW() + INTERVAL '7 days', NOW() + INTERVAL '8 days'
FROM public.workspace_members wm
WHERE wm.role = 'owner'
ON CONFLICT (owner_id) DO NOTHING;
