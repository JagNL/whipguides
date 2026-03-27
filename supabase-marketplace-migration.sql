-- ============================================================
-- WhipGuides — Marketplace 2.0 Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- ── View history (powers recommendations) ────────────────────
CREATE TABLE IF NOT EXISTS public.listing_views (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id  BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  session_id  TEXT,             -- for anonymous tracking
  category    TEXT,
  price       INTEGER,
  make        TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_user    ON public.listing_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON public.listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_session ON public.listing_views(session_id, viewed_at DESC);

-- ── Saved searches (notify when new matches appear) ──────────
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  query       TEXT,
  filters     JSONB NOT NULL DEFAULT '{}',
  -- filters: { category, minPrice, maxPrice, condition, minYear, maxYear, make, model, location, radius }
  notify      BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  result_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches(user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_select" ON public.saved_searches FOR SELECT USING (true);
CREATE POLICY "ss_insert" ON public.saved_searches FOR INSERT WITH CHECK (true);
CREATE POLICY "ss_update" ON public.saved_searches FOR UPDATE USING (true);
CREATE POLICY "ss_delete" ON public.saved_searches FOR DELETE USING (true);

-- ── Personal saved lists (Watchlist + custom) ─────────────────
CREATE TABLE IF NOT EXISTS public.saved_lists (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT DEFAULT '📋',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,  -- true = "Watchlist"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON public.saved_lists(user_id);

ALTER TABLE public.saved_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sl_select" ON public.saved_lists FOR SELECT USING (true);
CREATE POLICY "sl_insert" ON public.saved_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "sl_update" ON public.saved_lists FOR UPDATE USING (true);
CREATE POLICY "sl_delete" ON public.saved_lists FOR DELETE USING (true);

-- ── List items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_list_items (
  id          BIGSERIAL PRIMARY KEY,
  list_id     BIGINT NOT NULL REFERENCES public.saved_lists(id) ON DELETE CASCADE,
  listing_id  BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  note        TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_sli_list    ON public.saved_list_items(list_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_sli_listing ON public.saved_list_items(listing_id);

ALTER TABLE public.saved_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sli_select" ON public.saved_list_items FOR SELECT USING (true);
CREATE POLICY "sli_insert" ON public.saved_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "sli_update" ON public.saved_list_items FOR UPDATE USING (true);
CREATE POLICY "sli_delete" ON public.saved_list_items FOR DELETE USING (true);

-- ── Add year + mileage range columns to listings if missing ──
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS latitude  DECIMAL(9,6);
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);

-- ============================================================
-- DONE — tables: listing_views, saved_searches, saved_lists, saved_list_items
-- ============================================================
