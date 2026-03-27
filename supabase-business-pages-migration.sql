-- ============================================================
-- WhipGuides — Business Pages Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Business pages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_pages (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Identity
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,  -- URL-friendly: "smith-auto-repair"
  tagline         TEXT,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'General',
  -- Media
  logo_id         TEXT,   -- Cloudflare image ID
  cover_id        TEXT,
  -- Contact
  website         TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  latitude        DECIMAL(9,6),
  longitude       DECIMAL(9,6),
  -- Hours (JSON: { mon: "9am-5pm", ... })
  hours           JSONB DEFAULT '{}',
  -- Social links
  instagram       TEXT,
  facebook        TEXT,
  youtube         TEXT,
  -- Status
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  -- Stats (denormalized)
  follower_count  INTEGER NOT NULL DEFAULT 0,
  post_count      INTEGER NOT NULL DEFAULT 0,
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_pages_owner ON public.business_pages(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_pages_category ON public.business_pages(category);
CREATE INDEX IF NOT EXISTS idx_business_pages_slug ON public.business_pages(slug);

-- ── Business page follows ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_follows (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  page_id     INTEGER NOT NULL REFERENCES public.business_pages(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_business_follows_user ON public.business_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_business_follows_page ON public.business_follows(page_id);

-- ── Extend posts to support business page posts ───────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS business_page_id INTEGER REFERENCES public.business_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_business_page ON public.posts(business_page_id, created_at DESC);

-- ── Business page ↔ groups (a business can be linked to groups) ─
CREATE TABLE IF NOT EXISTS public.business_group_links (
  id          SERIAL PRIMARY KEY,
  page_id     INTEGER NOT NULL REFERENCES public.business_pages(id) ON DELETE CASCADE,
  group_id    INTEGER NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, group_id)
);

-- ── Business reviews (separate from user-to-user reviews) ─────
CREATE TABLE IF NOT EXISTS public.business_reviews (
  id          SERIAL PRIMARY KEY,
  page_id     INTEGER NOT NULL REFERENCES public.business_pages(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, reviewer_id)  -- one review per user per business
);

CREATE INDEX IF NOT EXISTS idx_business_reviews_page ON public.business_reviews(page_id, created_at DESC);
