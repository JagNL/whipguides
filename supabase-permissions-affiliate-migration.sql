-- ============================================================
-- WhipGuides — Granular Permissions + Affiliate/AI System
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- ── 1. Granular admin permissions on users ───────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT '{}';
  -- Structure: { "users.ban": true, "affiliate.manage_vendors": true, ... }
  -- Empty object = no special permissions beyond site_role

-- Index for permission queries
CREATE INDEX IF NOT EXISTS idx_users_admin_permissions
  ON public.users USING GIN(admin_permissions);

-- ── 2. Affiliate vendors ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_vendors (
  id            SERIAL      PRIMARY KEY,
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  provider_type TEXT        NOT NULL DEFAULT 'generic',
  -- provider_type: amazon | rockauto | brownells | ebay_motors |
  --                sweetwater | midwayusa | summit_racing | generic
  status        TEXT        NOT NULL DEFAULT 'active',
  -- status: active | paused | suspended
  verticals     TEXT[]      NOT NULL DEFAULT '{}',
  -- verticals this vendor applies to: automotive | firearms | music | maker | outdoors ...
  base_url      TEXT        NOT NULL DEFAULT '',
  affiliate_tag TEXT,        -- e.g. whipguides-20 (Amazon), etc.
  api_key       TEXT,        -- encrypted at rest via Supabase vault ideally
  api_secret    TEXT,
  commission_rate REAL      NOT NULL DEFAULT 0.05,  -- 5% default
  logo_url      TEXT,
  description   TEXT,
  quality_tier  TEXT        NOT NULL DEFAULT 'standard',
  -- quality_tier: premium | standard | budget
  notes         TEXT,        -- internal admin notes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_vendors_provider ON public.affiliate_vendors(provider_type);
CREATE INDEX IF NOT EXISTS idx_affiliate_vendors_verticals ON public.affiliate_vendors USING GIN(verticals);

-- ── 3. Parts extraction manifest per guide ──────────────────
CREATE TABLE IF NOT EXISTS public.guide_parts_manifest (
  id              SERIAL      PRIMARY KEY,
  guide_id        INTEGER     NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  -- Extraction metadata
  extracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extraction_model TEXT,      -- e.g. 'gpt-4o', 'claude-3-5-sonnet', 'llama3'
  extraction_version INTEGER  NOT NULL DEFAULT 1,
  -- Review state
  review_status   TEXT        NOT NULL DEFAULT 'pending',
  -- review_status: pending | approved | rejected | auto_approved
  reviewed_by     INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  auto_approve_score REAL,    -- 0-1 confidence; auto-approve if > threshold
  -- Extracted data (structured JSON)
  vehicle         JSONB       NOT NULL DEFAULT '{}',
  -- { year, make, model, engine, trim, vin_pattern }
  parts_removed   JSONB       NOT NULL DEFAULT '[]',
  -- [{ name, category, oem_part, confidence }]
  parts_needed    JSONB       NOT NULL DEFAULT '[]',
  -- [{ name, type, confidence, reason }]
  -- type: replacement | consumable | hardware | fluid
  upgrade_opportunities JSONB NOT NULL DEFAULT '[]',
  -- [{ name, benefit, estimated_hp_gain, brands, confidence, category }]
  safety_warnings JSONB       NOT NULL DEFAULT '[]',
  -- [{ component, warning, severity }]
  fluids          JSONB       NOT NULL DEFAULT '[]',
  tools_detected  JSONB       NOT NULL DEFAULT '[]',
  raw_llm_response TEXT,      -- full LLM output for debugging
  UNIQUE (guide_id, extraction_version)
);

CREATE INDEX IF NOT EXISTS idx_parts_manifest_guide   ON public.guide_parts_manifest(guide_id);
CREATE INDEX IF NOT EXISTS idx_parts_manifest_status  ON public.guide_parts_manifest(review_status);
CREATE INDEX IF NOT EXISTS idx_parts_manifest_extracted ON public.guide_parts_manifest(extracted_at DESC);

-- ── 4. Affiliate products (matched to parts) ────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_products (
  id              SERIAL      PRIMARY KEY,
  vendor_id       INTEGER     NOT NULL REFERENCES public.affiliate_vendors(id) ON DELETE CASCADE,
  manifest_id     INTEGER     REFERENCES public.guide_parts_manifest(id) ON DELETE CASCADE,
  -- null manifest_id = manually added product
  part_category   TEXT        NOT NULL DEFAULT 'replacement',
  -- part_category: replacement | upgrade | consumable | hardware | tool | fluid
  placement_type  TEXT        NOT NULL DEFAULT 'inline',
  -- placement_type: inline | sidebar | bundle | featured
  title           TEXT        NOT NULL,
  description     TEXT,
  product_url     TEXT        NOT NULL,
  affiliate_url   TEXT        NOT NULL,  -- pre-built with tracking params
  image_url       TEXT,
  price_cents     INTEGER,               -- stored in cents, null = unknown
  currency        TEXT        NOT NULL DEFAULT 'USD',
  brand           TEXT,
  part_number     TEXT,
  -- Fitment
  fits_year_start INTEGER,
  fits_year_end   INTEGER,
  fits_make       TEXT,
  fits_model      TEXT,
  fits_engine     TEXT,
  universal_fit   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Quality + curation
  quality_tier    TEXT        NOT NULL DEFAULT 'standard',
  is_featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_approved     BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_by     INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  -- Performance
  click_count     INTEGER     NOT NULL DEFAULT 0,
  conversion_count INTEGER    NOT NULL DEFAULT 0,
  revenue_cents   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_products_manifest  ON public.affiliate_products(manifest_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_vendor    ON public.affiliate_products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_approved  ON public.affiliate_products(is_approved) WHERE is_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_affiliate_products_fitment   ON public.affiliate_products(fits_make, fits_year_start, fits_year_end);

-- ── 5. Click tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id              BIGSERIAL   PRIMARY KEY,
  product_id      INTEGER     NOT NULL REFERENCES public.affiliate_products(id) ON DELETE CASCADE,
  guide_id        INTEGER     REFERENCES public.guides(id) ON DELETE SET NULL,
  user_id         INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  ip_hash         TEXT,       -- anonymised SHA-256 of IP+salt
  user_agent_hash TEXT,
  referrer        TEXT,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted       BOOLEAN     NOT NULL DEFAULT FALSE,
  conversion_value_cents INTEGER
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_product ON public.affiliate_clicks(product_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_guide   ON public.affiliate_clicks(guide_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_date    ON public.affiliate_clicks(clicked_at DESC);

-- ── 6. Affiliate revenue snapshots (daily rollup) ───────────
CREATE TABLE IF NOT EXISTS public.affiliate_revenue (
  id              SERIAL      PRIMARY KEY,
  date            DATE        NOT NULL,
  vendor_id       INTEGER     NOT NULL REFERENCES public.affiliate_vendors(id) ON DELETE CASCADE,
  guide_id        INTEGER     REFERENCES public.guides(id) ON DELETE SET NULL,
  clicks          INTEGER     NOT NULL DEFAULT 0,
  conversions     INTEGER     NOT NULL DEFAULT 0,
  revenue_cents   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, vendor_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_revenue_date   ON public.affiliate_revenue(date DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_revenue_vendor ON public.affiliate_revenue(vendor_id);

-- ── RLS: affiliate tables are server-only (no public reads) ──
ALTER TABLE public.affiliate_vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_parts_manifest      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_revenue         ENABLE ROW LEVEL SECURITY;

-- Public can read approved products + manifests (for guide pages)
CREATE POLICY "vendors_read"   ON public.affiliate_vendors    FOR SELECT USING (status = 'active');
CREATE POLICY "manifest_read"  ON public.guide_parts_manifest FOR SELECT USING (review_status IN ('approved','auto_approved'));
CREATE POLICY "products_read"  ON public.affiliate_products   FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "clicks_insert"  ON public.affiliate_clicks     FOR INSERT WITH CHECK (true);
CREATE POLICY "revenue_admin"  ON public.affiliate_revenue    FOR ALL   USING (true);

-- Server (service role) gets full access via supabaseAdmin client
-- which bypasses RLS automatically

-- ============================================================
-- DONE
-- Tables: affiliate_vendors, guide_parts_manifest,
--         affiliate_products, affiliate_clicks, affiliate_revenue
-- Column: users.admin_permissions
-- ============================================================
