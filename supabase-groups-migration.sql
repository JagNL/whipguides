-- ============================================================
-- WhipGuides — Chunk 4: Groups Social Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── post_likes table ─────────────────────────────────────────
-- Tracks who liked which post (prevents double-like)
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id    BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ── Add moderator role to group_members if not already present
-- (already has owner/admin/member from migration 1 — this is a no-op if so)
ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_likes_post   ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user   ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_likes_select" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert" ON public.post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "post_likes_delete" ON public.post_likes FOR DELETE USING (true);

-- ── Realtime on posts (for live post feed) ───────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- ============================================================
-- DONE — tables: post_likes
-- ============================================================
