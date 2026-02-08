-- Workspace settings table (shared team metadata)
-- Safe to run on existing projects. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_settings_owner_id ON public.workspace_settings(owner_id);

DROP POLICY IF EXISTS "Workspace members can view workspace settings" ON public.workspace_settings;
CREATE POLICY "Workspace members can view workspace settings"
  ON public.workspace_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.owner_id = workspace_settings.owner_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage workspace settings" ON public.workspace_settings;
CREATE POLICY "Owners can manage workspace settings"
  ON public.workspace_settings FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Backfill workspace settings from owner profiles when available
INSERT INTO public.workspace_settings (owner_id, company_name)
SELECT wm.owner_id, p.business_name
FROM public.workspace_members wm
JOIN public.profiles p ON p.id = wm.owner_id
WHERE wm.role = 'owner'
  AND p.business_name IS NOT NULL
  AND NULLIF(BTRIM(p.business_name), '') IS NOT NULL
ON CONFLICT (owner_id) DO NOTHING;
