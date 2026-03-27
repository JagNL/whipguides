-- ============================================================
-- WhipGuides — Private Groups Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- Join requests for private groups
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id         BIGSERIAL PRIMARY KEY,
  group_id   BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'denied')),
  message    TEXT,           -- optional note from the requester
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gjr_group_id ON public.group_join_requests(group_id, status);
CREATE INDEX IF NOT EXISTS idx_gjr_user_id  ON public.group_join_requests(user_id);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gjr_select" ON public.group_join_requests FOR SELECT USING (true);
CREATE POLICY "gjr_insert" ON public.group_join_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "gjr_update" ON public.group_join_requests FOR UPDATE USING (true);
CREATE POLICY "gjr_delete" ON public.group_join_requests FOR DELETE USING (true);

-- ============================================================
-- DONE — table: group_join_requests
-- ============================================================
