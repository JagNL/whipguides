-- ============================================================
-- WhipGuides — MFA / Security Migration
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- Track MFA enrollment status on our users table
-- (Supabase manages the actual factors in auth.mfa_factors)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_required       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- mfa_required: set true for super_admin/site_admin — blocks admin access without MFA
  ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip      TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ;

-- Admin session audit — every admin action gets a session entry
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token TEXT        NOT NULL,  -- hashed JWT sub
  ip_hash       TEXT,
  user_agent    TEXT,
  mfa_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user   ON public.admin_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token  ON public.admin_sessions(session_token);

-- Auto-expire old admin sessions after 24h
CREATE OR REPLACE FUNCTION expire_old_admin_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.admin_sessions
    SET ended_at = NOW()
    WHERE ended_at IS NULL
      AND last_active < NOW() - INTERVAL '24 hours';
END;
$$;

-- RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_sessions_all" ON public.admin_sessions FOR ALL USING (true);

-- ============================================================
-- DONE — modified: users; new: admin_sessions
-- ============================================================
