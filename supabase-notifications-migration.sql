-- ============================================================
-- WhipGuides — Notifications Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  -- type values:
  --   message          — new message received
  --   guide_like       — someone liked your guide
  --   guide_comment    — someone commented on your guide
  --   post_like        — someone liked your group post
  --   post_reply       — someone posted in a group you belong to
  --   group_join       — someone joined your group
  --   listing_save     — someone saved your listing
  --   listing_inquiry  — someone messaged about your listing

  title       TEXT NOT NULL,
  body        TEXT,
  -- optional links back to the relevant entity
  link_type   TEXT,   -- 'listing' | 'guide' | 'group' | 'message' | 'profile'
  link_id     BIGINT,
  -- actor (who triggered this notification)
  actor_id    BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON public.notifications(user_id, read) WHERE read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (true);

-- Realtime so the bell updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- DONE — table: notifications
-- ============================================================
