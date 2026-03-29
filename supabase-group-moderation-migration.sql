-- ============================================================
-- WhipGuides — Group Moderation Migration (v2)
-- Run this in the Supabase SQL Editor
-- Safe to run multiple times
-- ============================================================

SET search_path = public;

-- ── Ensure group_rules table exists ──────────────────────────
CREATE TABLE IF NOT EXISTS public.group_rules (
  id         BIGSERIAL PRIMARY KEY,
  group_id   BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  title      TEXT NOT NULL,
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_rules_group_id ON public.group_rules(group_id, position);
ALTER TABLE public.group_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_rules' AND policyname='group_rules_select') THEN
    CREATE POLICY "group_rules_select" ON public.group_rules FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_rules' AND policyname='group_rules_insert') THEN
    CREATE POLICY "group_rules_insert" ON public.group_rules FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_rules' AND policyname='group_rules_update') THEN
    CREATE POLICY "group_rules_update" ON public.group_rules FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_rules' AND policyname='group_rules_delete') THEN
    CREATE POLICY "group_rules_delete" ON public.group_rules FOR DELETE USING (true);
  END IF;
END $$;

-- ── Ensure columns exist on groups ───────────────────────────
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS slow_mode_seconds INTEGER DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS auto_approve_members BOOLEAN DEFAULT FALSE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS post_approval_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- ── Ensure columns exist on posts ────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── Group bans ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_bans (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  banned_by   BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  reason      TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_bans_group ON public.group_bans(group_id);
ALTER TABLE public.group_bans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_bans' AND policyname='group_bans_select') THEN
    CREATE POLICY "group_bans_select" ON public.group_bans FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_bans' AND policyname='group_bans_all') THEN
    CREATE POLICY "group_bans_all" ON public.group_bans FOR ALL USING (true);
  END IF;
END $$;

-- ── Group moderation log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_mod_logs (
  id              BIGSERIAL PRIMARY KEY,
  group_id        BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  moderator_id    BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_user_id  BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  target_post_id  BIGINT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_mod_logs_group ON public.group_mod_logs(group_id, created_at DESC);
ALTER TABLE public.group_mod_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_mod_logs' AND policyname='mod_logs_select') THEN
    CREATE POLICY "mod_logs_select" ON public.group_mod_logs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_mod_logs' AND policyname='mod_logs_insert') THEN
    CREATE POLICY "mod_logs_insert" ON public.group_mod_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- DONE
-- ============================================================
