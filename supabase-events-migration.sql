-- ============================================================
-- WhipGuides — Events Migration
-- Group-linked or standalone events with RSVP and geo discovery
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

CREATE TABLE IF NOT EXISTS public.events (
  id            SERIAL      PRIMARY KEY,
  title         TEXT        NOT NULL,
  description   TEXT,
  cover_image   TEXT,
  group_id      INTEGER     REFERENCES public.groups(id) ON DELETE SET NULL,
  organizer_id  INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vertical      TEXT        NOT NULL DEFAULT 'automotive',
  event_type    TEXT        NOT NULL DEFAULT 'meetup',
  -- event_type: meetup | track_day | show | swap_meet | auction | workshop | online | other
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  timezone      TEXT        NOT NULL DEFAULT 'America/Chicago',
  location_name TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  lat           REAL,
  lng           REAL,
  is_online     BOOLEAN     NOT NULL DEFAULT FALSE,
  online_url    TEXT,
  is_private    BOOLEAN     NOT NULL DEFAULT FALSE,
  capacity      INTEGER,                          -- NULL = unlimited
  rsvp_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at    ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_group        ON public.events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_organizer    ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_vertical     ON public.events(vertical);
CREATE INDEX IF NOT EXISTS idx_events_geo          ON public.events(lat, lng) WHERE lat IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id          SERIAL      PRIMARY KEY,
  event_id    INTEGER     NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'going',  -- going | maybe | not_going
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user  ON public.event_rsvps(user_id);

-- Keep rsvp_count in sync
CREATE OR REPLACE FUNCTION update_rsvp_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
    UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
    UPDATE public.events SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = OLD.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'going' AND NEW.status = 'going' THEN
      UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
    ELSIF OLD.status = 'going' AND NEW.status <> 'going' THEN
      UPDATE public.events SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = NEW.event_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvp_count ON public.event_rsvps;
CREATE TRIGGER trg_rsvp_count
  AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_rsvp_count();

ALTER TABLE public.events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select"      ON public.events      FOR SELECT USING (true);
CREATE POLICY "events_insert"      ON public.events      FOR INSERT WITH CHECK (true);
CREATE POLICY "events_update"      ON public.events      FOR UPDATE USING (true);
CREATE POLICY "events_delete"      ON public.events      FOR DELETE USING (true);
CREATE POLICY "rsvps_select"       ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "rsvps_insert"       ON public.event_rsvps FOR INSERT WITH CHECK (true);
CREATE POLICY "rsvps_update"       ON public.event_rsvps FOR UPDATE USING (true);
CREATE POLICY "rsvps_delete"       ON public.event_rsvps FOR DELETE USING (true);

-- ============================================================
-- DONE — new tables: events, event_rsvps; trigger on event_rsvps
-- ============================================================
