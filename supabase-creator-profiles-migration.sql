-- ============================================================
-- WhipGuides — Creator Profiles + Social Links Migration
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- Social links, creator mode, cover image, specialist tags on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS creator_mode       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_image        TEXT,
  ADD COLUMN IF NOT EXISTS website            TEXT,
  ADD COLUMN IF NOT EXISTS youtube_handle     TEXT,   -- e.g. @mkbhd or channel slug
  ADD COLUMN IF NOT EXISTS instagram_handle   TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle      TEXT,
  ADD COLUMN IF NOT EXISTS x_handle           TEXT,
  ADD COLUMN IF NOT EXISTS github_handle      TEXT,
  ADD COLUMN IF NOT EXISTS twitch_handle      TEXT,
  ADD COLUMN IF NOT EXISTS patreon_url        TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url       TEXT,
  ADD COLUMN IF NOT EXISTS specialist_tags    TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pinned_post_id     INTEGER     REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follower_count     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count    INTEGER     NOT NULL DEFAULT 0;

-- Profile-level posts: reuse posts table, mark with is_profile_post + profile_user_id
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_profile_post    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_user_id    INTEGER     REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_profile_user
  ON public.posts(profile_user_id, created_at DESC)
  WHERE is_profile_post = TRUE;

-- Fast follower count updates via trigger
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
    UPDATE public.users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET follower_count  = GREATEST(follower_count  - 1, 0) WHERE id = OLD.following_id;
    UPDATE public.users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counts ON public.user_follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ============================================================
-- DONE — modified: users, posts; trigger on user_follows
-- ============================================================
