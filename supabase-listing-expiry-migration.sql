-- ============================================================
-- WhipGuides — Listing Expiry + Freshness Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Add expiry / freshness columns to listings ────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refreshed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bump_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiry_warned   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expiry_warned2  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sold_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_score    INTEGER NOT NULL DEFAULT 0;

-- ── Backfill expires_at for existing active listings ──────────
-- Vehicles get 60 days, everything else 30 days from created_at
UPDATE public.listings
SET expires_at = CASE
  WHEN listing_type = 'vehicle' THEN created_at + INTERVAL '60 days'
  ELSE created_at + INTERVAL '30 days'
END
WHERE expires_at IS NULL AND status = 'active';

-- ── Index for expiry cron query ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_expires_at
  ON public.listings(expires_at, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON public.listings(status, created_at DESC);

-- ── Listing expiry log (track refresh history) ────────────────
CREATE TABLE IF NOT EXISTS public.listing_refreshes (
  id          SERIAL PRIMARY KEY,
  listing_id  INTEGER NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL DEFAULT 'refresh',  -- refresh | bump | relist
  previous_expires_at TIMESTAMPTZ,
  new_expires_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_refreshes_listing
  ON public.listing_refreshes(listing_id, created_at DESC);
