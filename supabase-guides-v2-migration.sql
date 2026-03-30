-- ============================================================
-- WhipGuides — Guides V2 Migration
-- Verticals, quality scoring, series, embeds, revenue share,
-- cross-system linkages (groups, marketplace, business pages)
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- ── 1. Extend guides table ────────────────────────────────────
ALTER TABLE public.guides
  -- Vertical system (replaces hardcoded automotive assumption)
  ADD COLUMN IF NOT EXISTS vertical         TEXT NOT NULL DEFAULT 'automotive',
  -- vertical: automotive|powersports|firearms|music|maker|outdoors|general|business

  -- Subject metadata — stored as JSONB, schema varies by vertical
  -- automotive:  { make, model, year_start, year_end, engine, trim }
  -- music:       { instrument, brand, model }
  -- maker:       { printer_brand, printer_model, material }
  -- firearms:    { manufacturer, model, caliber, type }
  -- powersports: { type, make, model, year }
  -- general:     { subject }
  ADD COLUMN IF NOT EXISTS subject_data     JSONB NOT NULL DEFAULT '{}',

  -- Quality scoring (fraud-resistant behavioral signals)
  ADD COLUMN IF NOT EXISTS quality_score    INTEGER NOT NULL DEFAULT 0, -- 0-100
  ADD COLUMN IF NOT EXISTS signal_count     INTEGER NOT NULL DEFAULT 0, -- total weighted signals
  ADD COLUMN IF NOT EXISTS is_monetized     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monetized_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monetized_by     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS community_verified BOOLEAN NOT NULL DEFAULT FALSE,
  -- community_verified = passed human review + quality threshold

  -- Series
  ADD COLUMN IF NOT EXISTS series_id        INTEGER,
  -- FK added after guide_series table created
  ADD COLUMN IF NOT EXISTS series_position  INTEGER, -- position within series (1-based)

  -- Media embeds (step-level embeds stored in steps JSONB, guide-level here)
  ADD COLUMN IF NOT EXISTS header_embed_url TEXT,  -- YouTube/Instagram URL for guide hero
  ADD COLUMN IF NOT EXISTS header_embed_type TEXT, -- 'youtube' | 'instagram' | null

  -- Cross-system linkages
  ADD COLUMN IF NOT EXISTS business_page_id INTEGER REFERENCES public.business_pages(id) ON DELETE SET NULL,
  -- A guide can be published under a business page instead of (or in addition to) a user profile
  ADD COLUMN IF NOT EXISTS group_id         INTEGER REFERENCES public.groups(id) ON DELETE SET NULL,
  -- A guide can be associated with a specific group

  -- Revenue sharing
  ADD COLUMN IF NOT EXISTS revenue_share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Controlled by kill switch in admin
  ADD COLUMN IF NOT EXISTS total_attributed_revenue_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid_out_cents INTEGER NOT NULL DEFAULT 0;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_guides_vertical      ON public.guides(vertical);
CREATE INDEX IF NOT EXISTS idx_guides_quality_score ON public.guides(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_guides_is_monetized  ON public.guides(is_monetized) WHERE is_monetized = TRUE;
CREATE INDEX IF NOT EXISTS idx_guides_series        ON public.guides(series_id, series_position);
CREATE INDEX IF NOT EXISTS idx_guides_business      ON public.guides(business_page_id);
CREATE INDEX IF NOT EXISTS idx_guides_group         ON public.guides(group_id);

-- ── 2. Guide Series ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_series (
  id              SERIAL      PRIMARY KEY,
  author_id       INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_page_id INTEGER    REFERENCES public.business_pages(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  cover_image     TEXT,
  vertical        TEXT        NOT NULL DEFAULT 'automotive',
  subject_data    JSONB       NOT NULL DEFAULT '{}',
  guide_count     INTEGER     NOT NULL DEFAULT 0,
  follower_count  INTEGER     NOT NULL DEFAULT 0,
  is_complete     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_public       BOOLEAN     NOT NULL DEFAULT TRUE,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_series_author   ON public.guide_series(author_id);
CREATE INDEX IF NOT EXISTS idx_guide_series_vertical  ON public.guide_series(vertical);

ALTER TABLE public.guide_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series_select" ON public.guide_series FOR SELECT USING (is_public OR true);
CREATE POLICY "series_insert" ON public.guide_series FOR INSERT WITH CHECK (true);
CREATE POLICY "series_update" ON public.guide_series FOR UPDATE USING (true);
CREATE POLICY "series_delete" ON public.guide_series FOR DELETE USING (true);

-- Add FK now that table exists
ALTER TABLE public.guides
  ADD CONSTRAINT fk_guides_series FOREIGN KEY (series_id)
  REFERENCES public.guide_series(id) ON DELETE SET NULL;

-- Series follows (notifications when new guide added to series)
CREATE TABLE IF NOT EXISTS public.guide_series_follows (
  series_id INTEGER NOT NULL REFERENCES public.guide_series(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, user_id)
);

ALTER TABLE public.guide_series_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series_follows_all" ON public.guide_series_follows FOR ALL USING (true);

-- ── 3. Quality Signal Tracking ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_signals (
  id              BIGSERIAL   PRIMARY KEY,
  guide_id        INTEGER     NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id         INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  -- user_id null = anonymous (lower weight)
  signal_type     TEXT        NOT NULL,
  -- signal_type values:
  --   step_complete   — user checked off a step
  --   helped          — "this guide helped me" button
  --   share           — shared to group/feed
  --   save            — bookmarked the guide
  --   return_visit    — came back > 5min after first view
  --   comment_quality — comment > 50 chars (indicates real engagement)
  --   marketplace_link— guide linked from a listing
  --   affiliate_click — clicked an affiliate product from guide
  weight          REAL        NOT NULL DEFAULT 1.0,
  -- weight adjusted by account_age_days at time of signal
  ip_hash         TEXT,        -- anonymized, for dedup
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dedup window: one signal per (guide_id, user_id, signal_type) per 30 days
  window_key      TEXT        NOT NULL
  -- window_key = guide_id || ':' || user_id || ':' || signal_type || ':' || YYYYMM
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_signals_dedup
  ON public.guide_signals(window_key);
CREATE INDEX IF NOT EXISTS idx_guide_signals_guide
  ON public.guide_signals(guide_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_signals_user
  ON public.guide_signals(user_id);

ALTER TABLE public.guide_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals_insert" ON public.guide_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "signals_select" ON public.guide_signals FOR SELECT USING (true);

-- Guide "helped" table (guide-level, distinct from post_helped)
CREATE TABLE IF NOT EXISTS public.guide_helped (
  guide_id  INTEGER NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  PRIMARY KEY (guide_id, user_id)
);

ALTER TABLE public.guide_helped ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guide_helped_all" ON public.guide_helped FOR ALL USING (true);

-- ── 4. Revenue Share / Payouts ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_revenue (
  id              SERIAL      PRIMARY KEY,
  guide_id        INTEGER     NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  author_id       INTEGER     NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  month           DATE        NOT NULL, -- first day of month
  attributed_clicks    INTEGER NOT NULL DEFAULT 0,
  attributed_revenue_cents INTEGER NOT NULL DEFAULT 0,
  pool_share_pct  REAL,        -- % of pool this guide earned
  payout_cents    INTEGER,     -- author's share
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- status: pending | approved | paid | skipped (below threshold)
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE (guide_id, month)
);

CREATE INDEX IF NOT EXISTS idx_guide_revenue_author ON public.guide_revenue(author_id);
CREATE INDEX IF NOT EXISTS idx_guide_revenue_month  ON public.guide_revenue(month DESC);
CREATE INDEX IF NOT EXISTS idx_guide_revenue_status ON public.guide_revenue(status);

ALTER TABLE public.guide_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guide_revenue_admin" ON public.guide_revenue FOR ALL USING (true);

-- Author payout details (where to send money)
CREATE TABLE IF NOT EXISTS public.author_payout_settings (
  user_id       INTEGER     PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  payout_method TEXT        NOT NULL DEFAULT 'paypal',
  -- payout_method: paypal | venmo | bank | crypto
  payout_email  TEXT,
  payout_details JSONB      NOT NULL DEFAULT '{}',
  minimum_threshold_cents INTEGER NOT NULL DEFAULT 2500, -- $25 default
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified      BOOLEAN     NOT NULL DEFAULT FALSE
);

ALTER TABLE public.author_payout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_settings_owner" ON public.author_payout_settings FOR ALL USING (true);

-- ── 5. Marketplace → Guide linkage ───────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS related_guide_id INTEGER REFERENCES public.guides(id) ON DELETE SET NULL;
  -- Seller can link "here's my guide for installing this part"

-- ── 6. Group → Guide library ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_guides (
  group_id    INTEGER NOT NULL REFERENCES public.groups(id)  ON DELETE CASCADE,
  guide_id    INTEGER NOT NULL REFERENCES public.guides(id)  ON DELETE CASCADE,
  added_by    INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_group_guides_group ON public.group_guides(group_id, position);

ALTER TABLE public.group_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_guides_all" ON public.group_guides FOR ALL USING (true);

-- ── 7. Revenue share kill switch (stored in settings table) ──
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings_write"  ON public.platform_settings FOR ALL  USING (true);

-- Seed default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('revenue_share', '{"enabled": false, "pool_pct": 20, "min_payout_cents": 2500, "min_quality_score": 70, "min_account_age_days": 30, "auto_approve_score": 85}'),
  ('guide_scoring', '{"weights": {"step_complete": 3, "helped": 5, "share": 4, "save": 2, "return_visit": 2, "comment_quality": 3, "marketplace_link": 5, "affiliate_click": 4}}')
ON CONFLICT (key) DO NOTHING;

-- ── 8. Quality score recalc trigger ──────────────────────────
CREATE OR REPLACE FUNCTION recalc_guide_quality_score(p_guide_id INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_score REAL := 0;
  v_count INTEGER := 0;
BEGIN
  -- Sum weighted signals from last 90 days
  SELECT COALESCE(SUM(weight), 0), COUNT(*)
    INTO v_score, v_count
    FROM public.guide_signals
    WHERE guide_id = p_guide_id
      AND recorded_at > NOW() - INTERVAL '90 days';

  -- Add like boost (likes are harder to fake but still have weight)
  SELECT v_score + COALESCE(likes * 1.5, 0) INTO v_score
    FROM public.guides WHERE id = p_guide_id;

  -- Normalize to 0-100
  v_score := LEAST(100, v_score * 2);

  UPDATE public.guides
    SET quality_score = ROUND(v_score)::INTEGER,
        signal_count = v_count,
        updated_at = NOW()
    WHERE id = p_guide_id;
END;
$$;

-- ============================================================
-- DONE
-- New tables: guide_series, guide_series_follows, guide_signals,
--   guide_helped, guide_revenue, author_payout_settings,
--   group_guides, platform_settings
-- Modified: guides, listings
-- ============================================================
