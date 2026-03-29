-- ============================================================
-- WhipGuides — Community Verticals Migration
-- Adds vertical tagging to groups + listings for multi-niche scale
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- Verticals: the top-level community buckets
-- Groups and listings belong to a vertical for discovery + filtering
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'automotive';
  -- Values: automotive | powersports | tech | maker | music | firearms |
  --         collectibles | outdoors | sports | pets | fashion | general

CREATE INDEX IF NOT EXISTS idx_groups_vertical ON public.groups(vertical);

-- Listings get a vertical too (drives category trees + compliance rules)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'automotive';

CREATE INDEX IF NOT EXISTS idx_listings_vertical ON public.listings(vertical);

-- Compliance flags per listing (firearms FFL, age-gate, local-pickup-only)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS requires_ffl       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age_restricted     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS local_pickup_only  BOOLEAN NOT NULL DEFAULT FALSE;

-- User vertical interests (drives feed personalisation + discovery)
CREATE TABLE IF NOT EXISTS public.user_vertical_interests (
  user_id   INTEGER NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  vertical  TEXT    NOT NULL,
  PRIMARY KEY (user_id, vertical)
);

-- ============================================================
-- DONE — modified: groups, listings; added: user_vertical_interests
-- ============================================================
