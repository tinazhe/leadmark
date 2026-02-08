-- Lead viewers (who is currently viewing a lead)
-- Safe to run on existing projects. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.lead_viewers (
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viewer_full_name TEXT NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_viewers_lead_id ON public.lead_viewers(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_viewers_last_seen_at ON public.lead_viewers(last_seen_at);
