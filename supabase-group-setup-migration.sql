-- ============================================================
-- WhipGuides — Group Setup Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

-- Group rules (each group can have multiple rules)
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
CREATE POLICY "group_rules_select" ON public.group_rules FOR SELECT USING (true);
CREATE POLICY "group_rules_insert" ON public.group_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "group_rules_update" ON public.group_rules FOR UPDATE USING (true);
CREATE POLICY "group_rules_delete" ON public.group_rules FOR DELETE USING (true);

-- Add avatar column to groups (separate from cover image)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Add setup_complete flag so we know if the wizard has been run
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT FALSE;

-- ============================================================
-- DONE — adds group_rules table, avatar + setup_complete to groups
-- ============================================================
