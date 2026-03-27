-- ============================================================
-- WhipGuides — Ads System + Admin Command Center Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Ad Accounts (one per advertiser) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id            SERIAL PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  website       TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'active'  -- active | suspended | pending
    CHECK (status IN ('active', 'suspended', 'pending')),
  balance       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_spent   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Ad Campaigns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  objective     TEXT NOT NULL DEFAULT 'awareness'  -- awareness | traffic | conversions
    CHECK (objective IN ('awareness', 'traffic', 'conversions')),
  status        TEXT NOT NULL DEFAULT 'draft'      -- draft | pending_review | active | paused | completed | rejected
    CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed', 'rejected')),
  budget_type   TEXT NOT NULL DEFAULT 'daily'      -- daily | total
    CHECK (budget_type IN ('daily', 'total')),
  budget_amount NUMERIC(10,2) NOT NULL DEFAULT 10,
  spent_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  bid_type      TEXT NOT NULL DEFAULT 'cpm'        -- cpm | cpc
    CHECK (bid_type IN ('cpm', 'cpc')),
  bid_amount    NUMERIC(10,4) NOT NULL DEFAULT 2.00,
  start_date    DATE,
  end_date      DATE,
  -- Targeting
  target_categories   JSONB DEFAULT '[]',   -- ["Cars","Trucks"]
  target_vehicle_makes JSONB DEFAULT '[]',  -- ["Ford","Chevy"]
  target_locations    JSONB DEFAULT '[]',   -- ["Texas","California"]
  target_group_ids    JSONB DEFAULT '[]',   -- specific group IDs
  target_min_age      INTEGER,
  target_max_age      INTEGER,
  -- Admin
  rejection_reason TEXT,
  reviewed_by   INTEGER REFERENCES public.users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Ad Creatives (each campaign can have multiple ads) ────────
CREATE TABLE IF NOT EXISTS public.ads (
  id            SERIAL PRIMARY KEY,
  campaign_id   INTEGER NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  account_id    INTEGER NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  format        TEXT NOT NULL DEFAULT 'feed_card'  -- feed_card | sidebar | group_banner | between_listings
    CHECK (format IN ('feed_card', 'sidebar', 'group_banner', 'between_listings')),
  status        TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'rejected')),
  -- Creative content
  headline      TEXT NOT NULL,
  body          TEXT,
  cta_text      TEXT NOT NULL DEFAULT 'Learn More',
  cta_url       TEXT NOT NULL,
  image_id      TEXT,   -- Cloudflare image ID
  image_url     TEXT,   -- fallback
  -- Stats (denormalized for fast reads)
  impressions   BIGINT NOT NULL DEFAULT 0,
  clicks        BIGINT NOT NULL DEFAULT 0,
  spend         NUMERIC(10,4) NOT NULL DEFAULT 0,
  -- Admin
  rejection_reason TEXT,
  reviewed_by   INTEGER REFERENCES public.users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Ad Impressions (for billing + analytics) ──────────────────
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id          BIGSERIAL PRIMARY KEY,
  ad_id       INTEGER NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL,
  account_id  INTEGER NOT NULL,
  user_id     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  page_context TEXT,   -- "marketplace" | "group:42" | "listing:100"
  ip_hash     TEXT,    -- hashed for fraud detection, not PII
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition-friendly index for billing queries
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created ON public.ad_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON public.ad_impressions(campaign_id, created_at DESC);

-- ── Ad Clicks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_clicks (
  id          BIGSERIAL PRIMARY KEY,
  ad_id       INTEGER NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL,
  account_id  INTEGER NOT NULL,
  user_id     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  ip_hash     TEXT,
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON public.ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_created ON public.ad_clicks(created_at DESC);

-- ── Keyword Blocklist ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.keyword_blocklist (
  id          SERIAL PRIMARY KEY,
  keyword     TEXT NOT NULL UNIQUE,
  match_type  TEXT NOT NULL DEFAULT 'contains'  -- contains | exact | starts_with
    CHECK (match_type IN ('contains', 'exact', 'starts_with')),
  action      TEXT NOT NULL DEFAULT 'flag'       -- flag | block | auto_reject
    CHECK (action IN ('flag', 'block', 'auto_reject')),
  applies_to  JSONB DEFAULT '["listing","post","ad"]',  -- which content types
  created_by  INTEGER REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Content Flags (auto-flagged by keyword engine) ────────────
CREATE TABLE IF NOT EXISTS public.content_flags (
  id          SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,   -- listing | post | ad | user | comment
  content_id  INTEGER NOT NULL,
  reason      TEXT NOT NULL,    -- keyword_match | user_report | ai_flag | manual
  keyword     TEXT,             -- which keyword triggered it (if applicable)
  status      TEXT NOT NULL DEFAULT 'pending'   -- pending | reviewed | dismissed | actioned
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  auto_action TEXT,             -- what was auto-done (blocked, etc.)
  reviewed_by INTEGER REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_status ON public.content_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_flags_content ON public.content_flags(content_type, content_id);

-- ── Seed a few default keyword rules ──────────────────────────
INSERT INTO public.keyword_blocklist (keyword, match_type, action, applies_to)
VALUES
  ('scam',         'contains', 'flag',        '["listing","post","ad"]'),
  ('stolen',       'contains', 'flag',        '["listing","post"]'),
  ('fake title',   'contains', 'flag',        '["listing"]'),
  ('no title',     'contains', 'flag',        '["listing"]'),
  ('wire transfer','contains', 'flag',        '["listing","post","ad"]'),
  ('western union','contains', 'flag',        '["listing","post"]'),
  ('drugs',        'contains', 'auto_reject', '["listing","post","ad"]'),
  ('illegal',      'contains', 'flag',        '["listing","post","ad"]')
ON CONFLICT (keyword) DO NOTHING;
