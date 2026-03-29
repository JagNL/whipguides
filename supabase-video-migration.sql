-- ============================================================
-- WhipGuides — Video Migration
-- Run this in the Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── Add video columns to posts (group videos) ─────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_id            TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_hls_url       TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;

-- ── Add video columns to listings (marketplace walk-arounds) ──
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS video_id            TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS video_hls_url       TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;

-- Indexes for quick lookup (e.g. admin, moderation)
CREATE INDEX IF NOT EXISTS idx_posts_video_id    ON public.posts(video_id)    WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_video_id ON public.listings(video_id) WHERE video_id IS NOT NULL;

-- ============================================================
-- DONE
-- New columns: posts.video_id, posts.video_hls_url, posts.video_thumbnail_url
--              listings.video_id, listings.video_hls_url, listings.video_thumbnail_url
--
-- Provider env vars to add in Railway (Cloudflare Stream):
--   CF_ACCOUNT_ID=<your_cloudflare_account_id>
--   CF_STREAM_TOKEN=<your_stream_api_token>
--
-- Kill switches (all default to enabled):
--   VIDEO_ENABLED=false         — disables all video
--   VIDEO_GROUP_ENABLED=false   — disables group videos only
--   VIDEO_LISTING_ENABLED=false — disables listing videos only
-- ============================================================
