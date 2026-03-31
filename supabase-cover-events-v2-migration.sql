-- ============================================================
-- WhipGuides — Cover Focal Point + Event Approval Migration
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

-- ── 1. Cover photo focal point for groups ─────────────────────
-- Stores where the user dragged the "focus point" as percentages (0-100).
-- Used as CSS object-position: {x}% {y}%
-- Default 50/50 = centered (current behaviour, no visual change for existing groups)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS cover_focal_x REAL NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_focal_y REAL NOT NULL DEFAULT 50;

-- ── 2. Event approval system ───────────────────────────────────
-- status: pending | approved | rejected
-- Group admins/owners can set approval_required on their group.
-- When enabled, new events linked to that group start as 'pending'.
-- Standalone events (no group_id) are auto-approved.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Allow group owners to require event approval
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS event_approval_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for approval queue queries
CREATE INDEX IF NOT EXISTS idx_events_status    ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_group_status ON public.events(group_id, status) WHERE group_id IS NOT NULL;

-- ── 3. Notification type support (ensure column is wide enough) ─
-- Nothing to change — notification type is free-text already

-- ── 4. RLS policies for new columns ───────────────────────────
-- groups table already has RLS; new columns inherit existing policies
-- events table: only allow selecting approved events (or own pending ones)
DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT USING (
  status = 'approved'
  OR organizer_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

-- Group admins/owners can see pending events for their group
-- (handled server-side via supabase-admin client — no separate policy needed)

COMMENT ON COLUMN public.groups.cover_focal_x IS 'Horizontal focal point 0-100% for cover photo object-position';
COMMENT ON COLUMN public.groups.cover_focal_y IS 'Vertical focal point 0-100% for cover photo object-position';
COMMENT ON COLUMN public.events.status IS 'pending | approved | rejected';
COMMENT ON COLUMN public.groups.event_approval_required IS 'When true, new events linked to this group start as pending';
