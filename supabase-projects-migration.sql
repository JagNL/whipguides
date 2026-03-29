-- ============================================================
-- WhipGuides — Project Journals Migration
-- Build logs / project threads tied to a user, not a group
-- Run in Supabase SQL Editor
-- ============================================================
SET search_path = public;

CREATE TABLE IF NOT EXISTS public.projects (
  id            SERIAL      PRIMARY KEY,
  user_id       INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vertical      TEXT        NOT NULL DEFAULT 'automotive',
  title         TEXT        NOT NULL,             -- "1969 Camaro LS Swap"
  description   TEXT,
  cover_image   TEXT,
  item_id       INTEGER     REFERENCES public.user_items(id) ON DELETE SET NULL,  -- links to My Garage
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  status        TEXT        NOT NULL DEFAULT 'active',  -- active | complete | abandoned
  is_public     BOOLEAN     NOT NULL DEFAULT TRUE,
  update_count  INTEGER     NOT NULL DEFAULT 0,
  view_count    INTEGER     NOT NULL DEFAULT 0,
  like_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user     ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_vertical  ON public.projects(vertical);
CREATE INDEX IF NOT EXISTS idx_projects_tags      ON public.projects USING GIN(tags);

CREATE TABLE IF NOT EXISTS public.project_updates (
  id          SERIAL      PRIMARY KEY,
  project_id  INTEGER     NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  images      TEXT[]      NOT NULL DEFAULT '{}',
  video_id    TEXT,               -- Cloudflare Stream video_id if attached
  video_hls_url TEXT,
  video_thumbnail_url TEXT,
  parts_used  JSONB       NOT NULL DEFAULT '[]',  -- [{name, brand, link, cost}]
  cost        INTEGER,            -- cost in cents for this update
  mileage     INTEGER,            -- odometer at time of update
  like_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project ON public.project_updates(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_likes (
  project_id  INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_follows (
  project_id  INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- Keep update_count current
CREATE OR REPLACE FUNCTION update_project_update_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects
      SET update_count = update_count + 1, updated_at = NOW()
      WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects
      SET update_count = GREATEST(update_count - 1, 0)
      WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_update_count ON public.project_updates;
CREATE TRIGGER trg_project_update_count
  AFTER INSERT OR DELETE ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION update_project_update_count();

ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proj_select"    ON public.projects        FOR SELECT USING (is_public OR true);
CREATE POLICY "proj_insert"    ON public.projects        FOR INSERT WITH CHECK (true);
CREATE POLICY "proj_update"    ON public.projects        FOR UPDATE USING (true);
CREATE POLICY "proj_delete"    ON public.projects        FOR DELETE USING (true);
CREATE POLICY "pup_select"     ON public.project_updates FOR SELECT USING (true);
CREATE POLICY "pup_insert"     ON public.project_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "pup_update"     ON public.project_updates FOR UPDATE USING (true);
CREATE POLICY "pup_delete"     ON public.project_updates FOR DELETE USING (true);
CREATE POLICY "plike_all"      ON public.project_likes   FOR ALL  USING (true);
CREATE POLICY "pfollow_all"    ON public.project_follows FOR ALL  USING (true);

-- ============================================================
-- DONE — new tables: projects, project_updates, project_likes, project_follows
-- ============================================================
