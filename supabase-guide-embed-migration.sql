-- ============================================================
-- WhipGuides — Guide Embed in Posts Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- Add guide_id to posts (nullable — not all posts embed a guide)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS guide_id BIGINT REFERENCES public.guides(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_guide_id ON public.posts(guide_id);

-- Add "helped" reaction table (wrench reactions on guide-embedded posts)
CREATE TABLE IF NOT EXISTS public.post_helped (
  post_id    BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_helped_post_id ON public.post_helped(post_id);

ALTER TABLE public.post_helped ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_helped_select" ON public.post_helped FOR SELECT USING (true);
CREATE POLICY "post_helped_insert" ON public.post_helped FOR INSERT WITH CHECK (true);
CREATE POLICY "post_helped_delete" ON public.post_helped FOR DELETE USING (true);

-- ============================================================
-- DONE — adds guide_id to posts, creates post_helped table
-- ============================================================
