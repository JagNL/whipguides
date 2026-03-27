-- ============================================================
-- WhipGuides — Universal Listing Types Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- Add listing_type column: 'vehicle' | 'parts' | 'general'
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'vehicle'
  CHECK (listing_type IN ('vehicle', 'parts', 'general'));

-- Add parts-specific fields: what vehicle it fits
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS fits_make     TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS fits_model    TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS fits_year_min INTEGER;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS fits_year_max INTEGER;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS part_number   TEXT;

-- Backfill existing listings as vehicles
UPDATE public.listings SET listing_type = 'vehicle' WHERE listing_type IS NULL;

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_listings_type ON public.listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_fits_make ON public.listings(fits_make) WHERE fits_make IS NOT NULL;

-- ============================================================
-- DONE
-- ============================================================
