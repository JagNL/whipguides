-- ============================================================
-- WhipGuides: posts_per_day on groups
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add column (safe to run multiple times)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS posts_per_day NUMERIC(6,2) NOT NULL DEFAULT 0;

-- 2. Backfill immediately using 30-day rolling window
--    posts_per_day = posts in last 30 days / 30
UPDATE public.groups g
SET posts_per_day = ROUND(
  COALESCE((
    SELECT COUNT(*)::NUMERIC / 30
    FROM public.posts p
    WHERE p.group_id = g.id
      AND p.created_at >= NOW() - INTERVAL '30 days'
  ), 0), 2
);

-- 3. Index so ORDER BY posts_per_day is fast at scale
CREATE INDEX IF NOT EXISTS idx_groups_posts_per_day ON public.groups(posts_per_day DESC);

-- Done
