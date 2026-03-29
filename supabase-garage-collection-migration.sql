-- ============================================================
-- WhipGuides — My Garage / My Collection Migration
-- Vertical-aware ownership table drives marketplace matching
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

CREATE TABLE IF NOT EXISTS public.user_items (
  id            SERIAL      PRIMARY KEY,
  user_id       INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vertical      TEXT        NOT NULL DEFAULT 'automotive',
  -- vertical-specific identity fields stored as JSONB for flexibility
  -- automotive:    { year, make, model, trim, mileage, color, vin }
  -- powersports:   { year, make, model, type }   type=atv|jetski|boat|motorcycle
  -- tech:          { brand, model, type }         type=printer|drone|camera
  -- music:         { brand, model, type }         type=guitar|bass|drums|synth
  -- firearms:      { make, model, caliber, type } type=handgun|rifle|shotgun
  -- collectibles:  { category, description, era }
  -- general:       { name, description }
  item_data     JSONB       NOT NULL DEFAULT '{}',
  title         TEXT        NOT NULL,  -- human-readable: "1969 Camaro SS" / "Gibson Les Paul"
  description   TEXT,
  images        TEXT[]      NOT NULL DEFAULT '{}',
  is_public     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_items_user    ON public.user_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_items_vertical ON public.user_items(vertical);

-- RLS: owners can CRUD their own; public items readable by all
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select" ON public.user_items FOR SELECT USING (is_public OR auth.uid()::text = user_id::text);
CREATE POLICY "items_insert" ON public.user_items FOR INSERT WITH CHECK (true);
CREATE POLICY "items_update" ON public.user_items FOR UPDATE USING (true);
CREATE POLICY "items_delete" ON public.user_items FOR DELETE USING (true);

-- ============================================================
-- DONE — new table: user_items
-- ============================================================
