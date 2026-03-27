-- ============================================================
-- WhipGuides: Guides Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- guides table
CREATE TABLE IF NOT EXISTS guides (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  -- vehicle info
  vehicle_make      TEXT NOT NULL,
  vehicle_model     TEXT NOT NULL,
  vehicle_year_start TEXT NOT NULL,
  vehicle_year_end   TEXT NOT NULL,
  -- metadata
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  time_estimate TEXT NOT NULL,   -- e.g. "2.5" hours
  category      TEXT,            -- Engine, Transmission, Brakes, etc.
  tags          TEXT[] DEFAULT '{}',
  tools         TEXT[] DEFAULT '{}',
  -- parts stored as JSONB array: [{name, link?, price?}]
  parts         JSONB DEFAULT '[]',
  -- steps stored as JSONB array: [{title, description, imageUrls?, tools?, parts?, estimatedTime?}]
  steps         JSONB DEFAULT '[]',
  -- cover image (Cloudflare Images ID)
  cover_image_id TEXT,
  -- author
  author_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- stats
  views         INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  -- timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- guide likes (one row per user per guide)
CREATE TABLE IF NOT EXISTS guide_likes (
  guide_id    BIGINT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guide_id, user_id)
);

-- guide comments
CREATE TABLE IF NOT EXISTS guide_comments (
  id          BIGSERIAL PRIMARY KEY,
  guide_id    BIGINT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS guides_author_id_idx       ON guides(author_id);
CREATE INDEX IF NOT EXISTS guides_difficulty_idx       ON guides(difficulty);
CREATE INDEX IF NOT EXISTS guides_category_idx         ON guides(category);
CREATE INDEX IF NOT EXISTS guides_created_at_idx       ON guides(created_at DESC);
CREATE INDEX IF NOT EXISTS guide_comments_guide_id_idx ON guide_comments(guide_id);
CREATE INDEX IF NOT EXISTS guide_likes_user_id_idx     ON guide_likes(user_id);

-- Auto-update updated_at on guides
CREATE OR REPLACE FUNCTION update_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guides_updated_at ON guides;
CREATE TRIGGER guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION update_guides_updated_at();
