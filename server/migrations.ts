/**
 * Startup migration runner.
 *
 * Runs pending SQL migrations at server startup using a direct Postgres
 * connection (DATABASE_URL env var, available on Railway + Supabase).
 * Tracks applied migrations in a lightweight `_wg_migrations` table.
 * All SQL is idempotent — safe to re-run.
 */

import { Pool } from "pg";

// ── Migration list ────────────────────────────────────────────────────────────
// Append to the END. Never edit an existing entry's id or sql.
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_guide_embed_in_posts",
    sql: `
      ALTER TABLE public.posts
        ADD COLUMN IF NOT EXISTS guide_id BIGINT REFERENCES public.guides(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_posts_guide_id ON public.posts(guide_id);
    `,
  },
  {
    id: "002_post_helped_table",
    sql: `
      CREATE TABLE IF NOT EXISTS public.post_helped (
        post_id    BIGINT NOT NULL REFERENCES public.posts(id)  ON DELETE CASCADE,
        user_id    BIGINT NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (post_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_post_helped_post_id ON public.post_helped(post_id);
      ALTER TABLE public.post_helped ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_helped' AND policyname='post_helped_select') THEN
          CREATE POLICY "post_helped_select" ON public.post_helped FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_helped' AND policyname='post_helped_insert') THEN
          CREATE POLICY "post_helped_insert" ON public.post_helped FOR INSERT WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_helped' AND policyname='post_helped_delete') THEN
          CREATE POLICY "post_helped_delete" ON public.post_helped FOR DELETE USING (true);
        END IF;
      END $$;
    `,
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────
export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[migrations] DATABASE_URL not set — skipping");
    return;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
    max: 2,
    connectionTimeoutMillis: 10_000,
  });

  try {
    // Ensure tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public._wg_migrations (
        id         TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch already-applied IDs
    const { rows } = await pool.query(`SELECT id FROM public._wg_migrations`);
    const applied = new Set(rows.map((r: any) => r.id));

    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;

      console.log(`[migrations] Applying ${m.id}...`);
      try {
        await pool.query(m.sql);
        await pool.query(
          `INSERT INTO public._wg_migrations(id) VALUES($1) ON CONFLICT DO NOTHING`,
          [m.id]
        );
        console.log(`[migrations] ✓ ${m.id}`);
      } catch (err: any) {
        // Log but don't crash the server — migration will retry next startup
        console.error(`[migrations] ✗ ${m.id}: ${err?.message}`);
      }
    }
  } catch (err: any) {
    console.error("[migrations] Runner error:", err?.message);
  } finally {
    await pool.end().catch(() => {});
  }
}
