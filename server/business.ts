/**
 * WhipGuides — Business Pages API
 * /api/business
 */
import { Router } from "express";
import { supabaseAdmin } from "./supabase";
import { requireAuth } from "./auth";
import { requireAdmin } from "./admin";

export const businessRouter = Router();

// ── Helpers ───────────────────────────────────────────────────
function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

async function enrichPage(page: any) {
  // Attach owner info
  const { data: owner } = await supabaseAdmin
    .from("users").select("id,username,display_name,avatar,verified").eq("id", page.owner_id).single();
  return { ...page, owner };
}

// ── List / search ─────────────────────────────────────────────
businessRouter.get("/", async (req, res) => {
  const { q, category, page = "1", limit = "20" } = req.query;
  const lim = Math.min(Number(limit), 40);
  const offset = (Number(page) - 1) * lim;

  let query = supabaseAdmin
    .from("business_pages")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .order("follower_count", { ascending: false })
    .range(offset, offset + lim - 1);

  if (q) query = query.ilike("name", `%${q}%`);
  if (category && category !== "all") query = query.eq("category", category);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ pages: data || [], total: count, page: Number(page), limit: lim });
});

// ── Get single page by id or slug ─────────────────────────────
businessRouter.get("/:idOrSlug", async (req, res) => {
  const { idOrSlug } = req.params;
  const isId = /^\d+$/.test(idOrSlug);

  const { data, error } = await supabaseAdmin
    .from("business_pages")
    .select("*")
    .eq(isId ? "id" : "slug", isId ? Number(idOrSlug) : idOrSlug)
    .single();

  if (error || !data) return res.status(404).json({ error: "Business page not found" });

  const enriched = await enrichPage(data);
  res.json(enriched);
});

// ── Create ────────────────────────────────────────────────────
businessRouter.post("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const {
    name, tagline, description, category,
    website, phone, email, address, city, state, zip,
    instagram, facebook, youtube,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "Business name is required" });
  if (!category) return res.status(400).json({ error: "Category is required" });

  // Generate unique slug
  let baseSlug = slugify(name.trim());
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: existing } = await supabaseAdmin
      .from("business_pages").select("id").eq("slug", slug).single();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data, error } = await supabaseAdmin.from("business_pages").insert({
    owner_id: currentUser.id,
    name: name.trim(),
    slug,
    tagline: tagline?.trim() || null,
    description: description?.trim() || null,
    category,
    website: website?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    address: address?.trim() || null,
    city: city?.trim() || null,
    state: state?.trim() || null,
    zip: zip?.trim() || null,
    instagram: instagram?.trim() || null,
    facebook: facebook?.trim() || null,
    youtube: youtube?.trim() || null,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ── Update ────────────────────────────────────────────────────
businessRouter.patch("/:id", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { data: page } = await supabaseAdmin
    .from("business_pages").select("owner_id").eq("id", req.params.id).single();
  if (!page) return res.status(404).json({ error: "Not found" });
  if (page.owner_id !== currentUser.id && (currentUser as any).siteRole !== "super_admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const allowed = [
    "name","tagline","description","category","website","phone","email",
    "address","city","state","zip","hours","instagram","facebook","youtube",
    "logo_id","cover_id",
  ];
  const updates: any = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("business_pages").update(updates).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Delete ────────────────────────────────────────────────────
businessRouter.delete("/:id", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { data: page } = await supabaseAdmin
    .from("business_pages").select("owner_id").eq("id", req.params.id).single();
  if (!page) return res.status(404).json({ error: "Not found" });
  if (page.owner_id !== currentUser.id && (currentUser as any).siteRole !== "super_admin") {
    return res.status(403).json({ error: "Not authorized" });
  }
  await supabaseAdmin.from("business_pages").delete().eq("id", req.params.id);
  res.json({ success: true });
});

// ── Follow / unfollow ─────────────────────────────────────────
businessRouter.post("/:id/follow", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const pageId = Number(req.params.id);

  const { error } = await supabaseAdmin
    .from("business_follows")
    .insert({ user_id: currentUser.id, page_id: pageId });

  if (error && error.code !== "23505") return res.status(400).json({ error: error.message });

  // Increment follower count
  await supabaseAdmin.rpc("increment_business_followers" as any, { page_id: pageId }).catch(() => {
    supabaseAdmin.from("business_pages")
      .select("follower_count").eq("id", pageId).single()
      .then(({ data }) => {
        if (data) supabaseAdmin.from("business_pages")
          .update({ follower_count: (data.follower_count || 0) + 1 }).eq("id", pageId);
      });
  });

  res.json({ following: true });
});

businessRouter.delete("/:id/follow", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const pageId = Number(req.params.id);

  await supabaseAdmin.from("business_follows")
    .delete().eq("user_id", currentUser.id).eq("page_id", pageId);

  // Decrement follower count
  const { data } = await supabaseAdmin
    .from("business_pages").select("follower_count").eq("id", pageId).single();
  if (data) await supabaseAdmin.from("business_pages")
    .update({ follower_count: Math.max(0, (data.follower_count || 1) - 1) }).eq("id", pageId);

  res.json({ following: false });
});

// GET follow status
businessRouter.get("/:id/follow-status", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { data } = await supabaseAdmin
    .from("business_follows")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("page_id", Number(req.params.id))
    .single();
  res.json({ following: !!data });
});

// GET pages the current user follows
businessRouter.get("/user/following", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { data } = await supabaseAdmin
    .from("business_follows")
    .select("page:page_id(*)")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });
  res.json((data || []).map((r: any) => r.page).filter(Boolean));
});

// GET pages owned by current user
businessRouter.get("/user/owned", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { data } = await supabaseAdmin
    .from("business_pages")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false });
  res.json(data || []);
});

// ── Posts ─────────────────────────────────────────────────────

// GET posts for a business page
businessRouter.get("/:id/posts", async (req, res) => {
  const { cursor, limit = "20" } = req.query;
  const lim = Math.min(Number(limit), 40);

  let query = supabaseAdmin
    .from("posts")
    .select(`
      id, content, images, guide_id, created_at, likes,
      reaction_counts, share_count, post_type,
      author:author_id(id, username, display_name, avatar, verified)
    `)
    .eq("business_page_id", Number(req.params.id))
    .order("created_at", { ascending: false })
    .limit(lim);

  if (cursor) query = query.lt("created_at", cursor as string);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const nextCursor = data && data.length === lim ? data[data.length - 1].created_at : null;
  res.json({ posts: data || [], nextCursor });
});

// POST — create a post as a business page
businessRouter.post("/:id/posts", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const pageId = Number(req.params.id);

  const { data: page } = await supabaseAdmin
    .from("business_pages").select("owner_id").eq("id", pageId).single();
  if (!page) return res.status(404).json({ error: "Business page not found" });
  if (page.owner_id !== currentUser.id) return res.status(403).json({ error: "Not your page" });

  const { content, images = [] } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Post content is required" });

  const { data, error } = await supabaseAdmin.from("posts").insert({
    author_id: currentUser.id,
    business_page_id: pageId,
    group_id: null,
    content: content.trim(),
    images,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  // Increment post count
  await supabaseAdmin.from("business_pages")
    .select("post_count").eq("id", pageId).single()
    .then(({ data: p }) => {
      if (p) supabaseAdmin.from("business_pages")
        .update({ post_count: (p.post_count || 0) + 1 }).eq("id", pageId);
    });

  res.status(201).json(data);
});

// ── Reviews ───────────────────────────────────────────────────

businessRouter.get("/:id/reviews", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("business_reviews")
    .select("*, reviewer:reviewer_id(id, username, display_name, avatar, verified)")
    .eq("page_id", Number(req.params.id))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

businessRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { rating, body } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });

  const { data, error } = await supabaseAdmin.from("business_reviews").upsert({
    page_id: Number(req.params.id),
    reviewer_id: currentUser.id,
    rating: Number(rating),
    body: body?.trim() || null,
  }, { onConflict: "page_id,reviewer_id" }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ── Listings linked to a business (by owner) ──────────────────
businessRouter.get("/:id/listings", async (req, res) => {
  const { data: page } = await supabaseAdmin
    .from("business_pages").select("owner_id").eq("id", req.params.id).single();
  if (!page) return res.status(404).json({ error: "Not found" });

  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("seller_id", page.owner_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(24);
  res.json(data || []);
});

// ── Admin: verify / suspend ───────────────────────────────────
businessRouter.post("/:id/verify", requireAuth, requireAdmin, async (req, res) => {
  await supabaseAdmin.from("business_pages").update({
    verified: true,
    verified_at: new Date().toISOString(),
  }).eq("id", req.params.id);
  res.json({ success: true });
});

businessRouter.post("/:id/suspend", requireAuth, requireAdmin, async (req, res) => {
  await supabaseAdmin.from("business_pages").update({ status: "suspended" }).eq("id", req.params.id);
  res.json({ success: true });
});

// ── Feed: posts from followed business pages ──────────────────
// GET /api/business/feed — used by the main feed
businessRouter.get("/feed/following", requireAuth, async (req, res) => {
  const currentUser = (req as any).currentUser;
  const { cursor, limit = "15" } = req.query;
  const lim = Math.min(Number(limit), 30);

  // Get followed page IDs
  const { data: follows } = await supabaseAdmin
    .from("business_follows")
    .select("page_id")
    .eq("user_id", currentUser.id);

  const pageIds = (follows || []).map((f: any) => f.page_id);
  if (!pageIds.length) return res.json({ posts: [], nextCursor: null });

  let query = supabaseAdmin
    .from("posts")
    .select(`
      id, content, images, created_at, likes, reaction_counts, share_count,
      author:author_id(id, username, display_name, avatar, verified),
      business_page:business_page_id(id, name, slug, logo_id, category, verified)
    `)
    .in("business_page_id", pageIds)
    .order("created_at", { ascending: false })
    .limit(lim);

  if (cursor) query = query.lt("created_at", cursor as string);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const nextCursor = data && data.length === lim ? data[data.length - 1].created_at : null;
  res.json({ posts: data || [], nextCursor });
});
