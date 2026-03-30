/**
 * server/guide-series.ts
 *
 * Guide Series API — ordered collections of related guides.
 *
 * A series is a creator/business-owned collection:
 *   - "Complete Engine Rebuild: 1969 Camaro LS Swap" (5 guides)
 *   - "Setting Up Your 3D Printer" (3 guides)
 *   - "Guitar Electronics: Full Mod Guide" (4 guides)
 *
 * Series integrate with:
 *   - Profiles (creator's series listed on their page)
 *   - Business pages (business-published series)
 *   - Feed (new guide added to series → followers notified)
 *   - Notifications (series followers get alerts)
 */

import { Router } from "express";
import { requireAuth } from "./auth";
import { supabaseAdmin } from "./supabase";

export const guideSeriesRouter = Router();
const sb = supabaseAdmin;

// ─── GET /api/guide-series — list series (filterable) ────────
guideSeriesRouter.get("/", async (req, res) => {
  const { vertical, authorId, businessId, limit = "20", cursor } = req.query;

  let q = sb!.from("guide_series")
    .select(`
      *,
      author:users!guide_series_author_id_fkey(id, username, display_name, avatar, verified, creator_mode),
      business:business_pages(id, name, slug, logo_id)
    `)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Number(limit), 50));

  if (vertical) q = q.eq("vertical", vertical as string);
  if (authorId) q = q.eq("author_id", Number(authorId));
  if (businessId) q = q.eq("business_page_id", Number(businessId));
  if (cursor) q = q.lt("updated_at", cursor as string);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// ─── GET /api/guide-series/:id ────────────────────────────────
guideSeriesRouter.get("/:id", async (req, res) => {
  const { data: series, error } = await sb!.from("guide_series")
    .select(`
      *,
      author:users!guide_series_author_id_fkey(id, username, display_name, avatar, verified, creator_mode, follower_count),
      business:business_pages(id, name, slug, logo_id, verified)
    `)
    .eq("id", Number(req.params.id))
    .single();

  if (error || !series) return res.status(404).json({ error: "Series not found" });

  // Fetch guides in order
  const { data: guides } = await sb!.from("guides")
    .select("id, title, description, difficulty, time_estimate, cover_image_id, quality_score, community_verified, views, likes, series_position, vertical, subject_data")
    .eq("series_id", Number(req.params.id))
    .order("series_position", { ascending: true });

  res.json({ ...series, guides: guides ?? [] });
});

// ─── POST /api/guide-series — create series ───────────────────
guideSeriesRouter.post("/", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { title, description, coverImage, vertical = "automotive", subjectData = {}, isPublic = true, tags = [], businessPageId } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: "Title required" });

  // Verify business page ownership if provided
  if (businessPageId) {
    const { data: biz } = await sb!.from("business_pages").select("owner_id").eq("id", businessPageId).single();
    if (!biz || biz.owner_id !== user.id) return res.status(403).json({ error: "Not your business page" });
  }

  const { data, error } = await sb!.from("guide_series").insert({
    author_id: user.id,
    business_page_id: businessPageId || null,
    title: title.trim(),
    description: description?.trim() || null,
    cover_image: coverImage || null,
    vertical,
    subject_data: subjectData,
    is_public: isPublic,
    tags,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ─── PATCH /api/guide-series/:id ─────────────────────────────
guideSeriesRouter.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: existing } = await sb!.from("guide_series").select("author_id").eq("id", Number(req.params.id)).single();
  if (!existing || existing.author_id !== user.id) return res.status(403).json({ error: "Not your series" });

  const allowed = ["title", "description", "cover_image", "is_complete", "is_public", "tags", "vertical", "subject_data"];
  const updates: any = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }

  const { data, error } = await sb!.from("guide_series").update(updates).eq("id", Number(req.params.id)).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── DELETE /api/guide-series/:id ────────────────────────────
guideSeriesRouter.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: existing } = await sb!.from("guide_series").select("author_id").eq("id", Number(req.params.id)).single();
  if (!existing || existing.author_id !== user.id) return res.status(403).json({ error: "Not your series" });

  // Remove series_id from all guides in this series
  await sb!.from("guides").update({ series_id: null, series_position: null }).eq("series_id", Number(req.params.id));
  await sb!.from("guide_series").delete().eq("id", Number(req.params.id));
  res.json({ success: true });
});

// ─── POST /api/guide-series/:id/guides — add guide to series ──
guideSeriesRouter.post("/:id/guides", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { guideId } = req.body;
  if (!guideId) return res.status(400).json({ error: "guideId required" });

  // Verify series ownership
  const { data: series } = await sb!.from("guide_series").select("author_id, guide_count").eq("id", Number(req.params.id)).single();
  if (!series || series.author_id !== user.id) return res.status(403).json({ error: "Not your series" });

  // Verify guide ownership
  const { data: guide } = await sb!.from("guides").select("author_id, title").eq("id", Number(guideId)).single();
  if (!guide || guide.author_id !== user.id) return res.status(403).json({ error: "Not your guide" });

  // Get next position
  const { data: lastGuide } = await sb!.from("guides")
    .select("series_position")
    .eq("series_id", Number(req.params.id))
    .order("series_position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (lastGuide?.series_position ?? 0) + 1;

  await sb!.from("guides").update({
    series_id: Number(req.params.id),
    series_position: nextPosition,
  }).eq("id", Number(guideId));

  // Update guide_count on series
  await sb!.from("guide_series").update({
    guide_count: (series.guide_count || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", Number(req.params.id));

  // Notify series followers (fire & forget)
  notifySeriesFollowers(Number(req.params.id), user.id, guide.title, Number(guideId)).catch(() => {});

  res.json({ success: true, position: nextPosition });
});

// ─── DELETE /api/guide-series/:id/guides/:guideId ─────────────
guideSeriesRouter.delete("/:id/guides/:guideId", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: series } = await sb!.from("guide_series").select("author_id, guide_count").eq("id", Number(req.params.id)).single();
  if (!series || series.author_id !== user.id) return res.status(403).json({ error: "Not your series" });

  await sb!.from("guides").update({ series_id: null, series_position: null }).eq("id", Number(req.params.guideId));
  await sb!.from("guide_series").update({ guide_count: Math.max(0, (series.guide_count || 1) - 1) }).eq("id", Number(req.params.id));
  res.json({ success: true });
});

// ─── PATCH /api/guide-series/:id/reorder — reorder guides ────
guideSeriesRouter.patch("/:id/reorder", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { order } = req.body; // [{ guideId, position }, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });

  const { data: series } = await sb!.from("guide_series").select("author_id").eq("id", Number(req.params.id)).single();
  if (!series || series.author_id !== user.id) return res.status(403).json({ error: "Not your series" });

  for (const item of order) {
    await sb!.from("guides").update({ series_position: item.position }).eq("id", item.guideId).eq("series_id", Number(req.params.id));
  }
  res.json({ success: true });
});

// ─── POST /api/guide-series/:id/follow ───────────────────────
guideSeriesRouter.post("/:id/follow", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("guide_series_follows")
    .upsert({ series_id: Number(req.params.id), user_id: user.id }, { ignoreDuplicates: true });
  await sb!.from("guide_series").update({ follower_count: sb!.rpc }).eq("id", Number(req.params.id)).then(() => {});
  // Recount properly
  const { count } = await sb!.from("guide_series_follows").select("*", { count: "exact", head: true }).eq("series_id", Number(req.params.id));
  await sb!.from("guide_series").update({ follower_count: count ?? 0 }).eq("id", Number(req.params.id));
  res.json({ following: true });
});

// ─── DELETE /api/guide-series/:id/follow ─────────────────────
guideSeriesRouter.delete("/:id/follow", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("guide_series_follows").delete().eq("series_id", Number(req.params.id)).eq("user_id", user.id);
  const { count } = await sb!.from("guide_series_follows").select("*", { count: "exact", head: true }).eq("series_id", Number(req.params.id));
  await sb!.from("guide_series").update({ follower_count: count ?? 0 }).eq("id", Number(req.params.id));
  res.json({ following: false });
});

// ─── GET /api/guide-series/:id/following ─────────────────────
guideSeriesRouter.get("/:id/following", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await sb!.from("guide_series_follows").select("series_id").eq("series_id", Number(req.params.id)).eq("user_id", user.id).single();
  res.json({ following: !!data });
});

// ─── Internal: notify series followers ───────────────────────
async function notifySeriesFollowers(seriesId: number, authorId: number, guideTitle: string, guideId: number) {
  if (!sb) return;
  const [{ data: followers }, { data: series }, { data: author }] = await Promise.all([
    sb.from("guide_series_follows").select("user_id").eq("series_id", seriesId).neq("user_id", authorId),
    sb.from("guide_series").select("title").eq("id", seriesId).single(),
    sb.from("users").select("display_name").eq("id", authorId).single(),
  ]);

  if (!followers?.length) return;

  const seriesTitle = (series as any)?.title || "a series";
  const authorName = (author as any)?.display_name || "Someone";

  const notes = followers.map((f: any) => ({
    user_id: f.user_id,
    type: "series_update",
    title: `New guide in "${seriesTitle}"`,
    body: `${authorName} added: ${guideTitle}`,
    link_type: "guide",
    link_id: guideId,
    actor_id: authorId,
  }));

  await sb.from("notifications").insert(notes).catch(() => {});
}
