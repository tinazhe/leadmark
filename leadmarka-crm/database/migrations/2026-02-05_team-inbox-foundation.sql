-- Team Inbox foundation tables and columns
-- Safe to run on existing projects. Run in Supabase SQL Editor.

-- Workspace members (workspace = account owner)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_owner_user_unique') THEN
    ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_owner_user_unique UNIQUE (owner_id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_user_unique') THEN
    ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_user_unique UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_members_owner_id ON public.workspace_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

DROP POLICY IF EXISTS "Workspace members can view workspace membership" ON public.workspace_members;
CREATE POLICY "Workspace members can view workspace membership"
  ON public.workspace_members FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can manage workspace members" ON public.workspace_members;
CREATE POLICY "Owners can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Pending invites for new users
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pending_invites_owner_id ON public.pending_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON public.pending_invites(email);

DROP POLICY IF EXISTS "Owners can manage pending invites" ON public.pending_invites;
CREATE POLICY "Owners can manage pending invites"
  ON public.pending_invites FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Lead assignment
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id ON public.leads(assigned_user_id);

-- Activity log
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'lead_created',
    'lead_updated',
    'status_change',
    'follow_up_created',
    'follow_up_completed',
    'lead_reassigned',
    'note_added',
    'note_edited'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON public.activity_logs(lead_id);

DROP POLICY IF EXISTS "Workspace members can view activity logs" ON public.activity_logs;
CREATE POLICY "Workspace members can view activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = activity_logs.lead_id
        AND (
          l.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.owner_id = l.user_id AND wm.user_id = auth.uid()
          )
        )
    )
  );
