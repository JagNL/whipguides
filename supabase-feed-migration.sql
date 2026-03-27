-- ============================================================
-- WhipGuides — Community Feed Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── User follows (follow people, not just groups) ─────────────
CREATE TABLE IF NOT EXISTS public.user_follows (
  id          SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- ── Post reactions (beyond just likes — flexible emoji reactions) ──
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction    TEXT NOT NULL DEFAULT 'like',  -- like | love | haha | wow | helpful | fire
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)  -- one reaction per user per post (can change)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

-- ── Feed items cache (denormalized for fast feed queries) ──────
-- This table is optional but makes infinite-scroll feed fast.
-- We can also just query posts + listings JOIN groups WHERE user is member.
-- For now we'll do the join approach and add this table later if needed.

-- ── Add follow counts to users ─────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS follower_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0;

-- ── Add reaction counts + share count to posts ────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reaction_counts JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS share_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS post_type       TEXT NOT NULL DEFAULT 'text';
  -- post_type: text | image | guide_share | listing_share | poll | event

-- ── Polls (attached to posts) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_polls (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',  -- [{id, text, votes}]
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id          SERIAL PRIMARY KEY,
  poll_id     INTEGER NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_id   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);
