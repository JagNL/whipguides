-- ============================================================
-- WhipGuides — Group Membership Questions + Phone Verification
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Group membership questions (set by owner/mods) ───────────
CREATE TABLE IF NOT EXISTS public.group_questions (
  id          SERIAL PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_questions_group ON public.group_questions(group_id, sort_order);

-- ── Answers to membership questions (stored on join request) ─
ALTER TABLE public.group_join_requests
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- ── Phone verifications (rate-limited OTP) ───────────────────
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)  -- one active verification per user
);

-- ── Add verified_phone to users ───────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_age_days INTEGER GENERATED ALWAYS AS
    (EXTRACT(DAY FROM NOW() - created_at)::INTEGER) STORED;

-- ── Bot/spam protection signals ───────────────────────────────
-- These columns let the server compute a risk score per join request
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS listing_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS groups_joined   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_count    INTEGER NOT NULL DEFAULT 0;
