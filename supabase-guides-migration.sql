-- ============================================================
-- WhipGuides — Guides Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- ── Guides ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guides (
  id                 BIGSERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  vehicle_make       TEXT NOT NULL,
  vehicle_model      TEXT NOT NULL,
  vehicle_year_start TEXT NOT NULL,
  vehicle_year_end   TEXT NOT NULL,
  difficulty         TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  time_estimate      TEXT NOT NULL,
  category           TEXT,
  tags               TEXT[] DEFAULT '{}',
  tools              TEXT[] DEFAULT '{}',
  parts              JSONB  DEFAULT '[]',
  steps              JSONB  DEFAULT '[]',
  cover_image_id     TEXT,
  author_id          BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  views              INTEGER NOT NULL DEFAULT 0,
  likes              INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Guide Likes (one row per user per guide) ─────────────────
CREATE TABLE IF NOT EXISTS public.guide_likes (
  guide_id   BIGINT NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guide_id, user_id)
);

-- ── Guide Comments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_comments (
  id         BIGSERIAL PRIMARY KEY,
  guide_id   BIGINT NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guides_author_id        ON public.guides(author_id);
CREATE INDEX IF NOT EXISTS idx_guides_difficulty        ON public.guides(difficulty);
CREATE INDEX IF NOT EXISTS idx_guides_category          ON public.guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_created_at        ON public.guides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_comments_guide_id  ON public.guide_comments(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_likes_user_id      ON public.guide_likes(user_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.guides         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guides_select"         ON public.guides         FOR SELECT USING (true);
CREATE POLICY "guides_insert"         ON public.guides         FOR INSERT WITH CHECK (true);
CREATE POLICY "guides_update"         ON public.guides         FOR UPDATE USING (true);
CREATE POLICY "guides_delete"         ON public.guides         FOR DELETE USING (true);

CREATE POLICY "guide_likes_select"    ON public.guide_likes    FOR SELECT USING (true);
CREATE POLICY "guide_likes_insert"    ON public.guide_likes    FOR INSERT WITH CHECK (true);
CREATE POLICY "guide_likes_delete"    ON public.guide_likes    FOR DELETE USING (true);

CREATE POLICY "guide_comments_select" ON public.guide_comments FOR SELECT USING (true);
CREATE POLICY "guide_comments_insert" ON public.guide_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "guide_comments_delete" ON public.guide_comments FOR DELETE USING (true);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guides_updated_at ON public.guides;
CREATE TRIGGER guides_updated_at
  BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.update_guides_updated_at();

-- ============================================================
-- DONE — tables: guides, guide_likes, guide_comments
-- ============================================================
