-- ============================================================
-- WhipGuides — Badges & Reputation Migration
-- Auto-awarded achievement system, specialist tags
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id          SERIAL      PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_key   TEXT        NOT NULL,
  -- badge_key values:
  --   first_sale        | seller_10 | seller_50 | seller_100 | top_seller
  --   first_listing     | verified_seller
  --   guide_author      | guide_10  | guide_helpful
  --   group_founder     | group_admin | group_moderator
  --   community_member  | early_adopter
  --   follower_10       | follower_100 | follower_1k
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_select" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "badges_insert" ON public.user_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "badges_update" ON public.user_badges FOR UPDATE USING (true);
CREATE POLICY "badges_delete" ON public.user_badges FOR DELETE USING (true);

-- specialist_tags already added in creator-profiles migration (TEXT[] on users)

-- ============================================================
-- DONE — new table: user_badges
-- ============================================================
