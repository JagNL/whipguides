-- ============================================================
-- WhipGuides — Post Comments Migration
-- Run in Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- ── post_comments table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_comments (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT      NOT NULL REFERENCES public.posts(id)  ON DELETE CASCADE,
  author_id   BIGINT      NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id  ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author   ON public.post_comments(author_id);

-- RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "post_comments_select" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "post_comments_insert" ON public.post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "post_comments_delete" ON public.post_comments FOR DELETE USING (true);
CREATE POLICY IF NOT EXISTS "post_comments_update" ON public.post_comments FOR UPDATE USING (true);

-- ── Ensure comment_count column exists on posts ───────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- DONE
-- ============================================================
