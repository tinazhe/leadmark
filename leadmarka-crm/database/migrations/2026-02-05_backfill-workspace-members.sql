-- Backfill workspace membership for existing users
-- Safe to run on existing projects. Run in Supabase SQL Editor.

INSERT INTO public.workspace_members (owner_id, user_id, role)
SELECT id, id, 'owner'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Ensure legacy leads are assigned to their creator by default
UPDATE public.leads
SET assigned_user_id = user_id
WHERE assigned_user_id IS NULL;
