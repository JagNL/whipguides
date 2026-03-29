/**
 * server/community.ts
 * Routes for: Creator Profiles, My Garage/Collection, Badges, Events, Projects
 * All new community platform features in one focused router.
 */
import { Router } from "express";
import { supabaseAdmin } from "./supabase";
import { requireAuth } from "./auth";

const sb = supabaseAdmin;
export const communityRouter = Router();

// ─── helpers ─────────────────────────────────────────────────
const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> =>
  Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]])) as Pick<T, K>;

// ============================================================
// CREATOR PROFILES
// ============================================================

// PATCH /api/creator/profile — toggle creator mode + update social links
communityRouter.patch("/profile", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const allowed = [
    "creator_mode", "cover_image", "website",
    "youtube_handle", "instagram_handle", "tiktok_handle",
    "x_handle", "github_handle", "twitch_handle",
    "patreon_url", "facebook_url", "specialist_tags",
  ];
  const update = pick(req.body, allowed as any);
  if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const { data, error } = await sb!.from("users").update(update).eq("id", user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/creator/:userId/posts — profile-level posts for a user
communityRouter.get("/:userId/posts", async (req, res) => {
  const { userId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string | undefined;

  let q = sb!.from("posts")
    .select("*, author:users!posts_author_id_fkey(id,display_name,username,avatar,verified,creator_mode,specialist_tags)")
    .eq("profile_user_id", userId)
    .eq("is_profile_post", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/creator/posts — create a profile post
communityRouter.post("/posts", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { content, images = [], video_id, video_hls_url, video_thumbnail_url } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Content required" });

  const { data, error } = await sb!.from("posts").insert({
    author_id: user.id,
    profile_user_id: user.id,
    is_profile_post: true,
    group_id: null,
    content: content.trim(),
    images,
    ...(video_id ? { video_id, video_hls_url, video_thumbnail_url } : {}),
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Fire follow notification asynchronously
  fireFollowersNotification(user.id, "new_post", data.id).catch(() => {});
  res.status(201).json(data);
});

// POST /api/creator/:userId/pin/:postId — pin a post to creator page
communityRouter.post("/:userId/pin/:postId", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  if (user.id !== Number(req.params.userId)) return res.status(403).json({ error: "Forbidden" });
  const { error } = await sb!.from("users")
    .update({ pinned_post_id: Number(req.params.postId) })
    .eq("id", user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/creator/:userId/pin — unpin
communityRouter.delete("/:userId/pin", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  if (user.id !== Number(req.params.userId)) return res.status(403).json({ error: "Forbidden" });
  await sb!.from("users").update({ pinned_post_id: null }).eq("id", user.id);
  res.json({ success: true });
});

// ============================================================
// MY GARAGE / COLLECTION
// ============================================================

// GET /api/garage/:userId — get a user's items
communityRouter.get("/garage/:userId", async (req, res) => {
  const { userId } = req.params;
  const vertical = req.query.vertical as string | undefined;
  let q = sb!.from("user_items")
    .select("*")
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (vertical) q = q.eq("vertical", vertical);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/garage/mine — own items including private
communityRouter.get("/garage/mine/all", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data, error } = await sb!.from("user_items")
    .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/garage — add an item
communityRouter.post("/garage", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { vertical = "automotive", title, description, item_data = {}, images = [], is_public = true } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const { data, error } = await sb!.from("user_items").insert({
    user_id: user.id, vertical, title: title.trim(), description, item_data, images, is_public,
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/garage/:id — update an item
communityRouter.patch("/garage/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const allowed = ["title", "description", "item_data", "images", "is_public", "vertical"];
  const update = pick(req.body, allowed as any);
  const { data, error } = await sb!.from("user_items")
    .update(update).eq("id", req.params.id).eq("user_id", user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// DELETE /api/garage/:id — delete an item
communityRouter.delete("/garage/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { error } = await sb!.from("user_items")
    .delete().eq("id", req.params.id).eq("user_id", user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/garage/matches — listings that match user's items
communityRouter.get("/garage/matches", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: items } = await sb!.from("user_items")
    .select("vertical, item_data").eq("user_id", user.id);
  if (!items?.length) return res.json([]);

  // Build OR filter: listings matching make+model from automotive items
  const automotiveItems = items.filter(i => i.vertical === "automotive");
  if (!automotiveItems.length) return res.json([]);

  const makeModels = automotiveItems
    .map(i => i.item_data as any)
    .filter(d => d?.make)
    .slice(0, 5); // cap to avoid huge queries

  if (!makeModels.length) return res.json([]);

  // Fetch active listings matching any of those makes
  const makes = [...new Set(makeModels.map(d => d.make))];
  let q = sb!.from("listings")
    .select("*")
    .eq("status", "active")
    .in("make", makes)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// ============================================================
// BADGES
// ============================================================

// GET /api/badges/:userId
communityRouter.get("/badges/:userId", async (req, res) => {
  const { data, error } = await sb!.from("user_badges")
    .select("*").eq("user_id", req.params.userId).order("awarded_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// Internal: award a badge (no duplicate) + notify user on first award
export async function awardBadge(userId: number, badgeKey: string) {
  if (!sb) return;
  const { data: existing } = await sb.from("user_badges")
    .select("user_id").eq("user_id", userId).eq("badge_key", badgeKey).single();
  if (existing) return; // already has it — no duplicate, no noise
  await sb.from("user_badges").insert({ user_id: userId, badge_key: badgeKey });
  // Notify user they earned a badge
  const BADGE_LABELS: Record<string, string> = {
    first_sale: "First Sale", seller_10: "Power Seller", seller_50: "Top Trader",
    seller_100: "Legend", first_listing: "Lister", guide_author: "Guide Author",
    guide_10: "Expert", group_founder: "Founder", group_admin: "Admin",
    follower_10: "Rising Star", follower_100: "Influencer", follower_1k: "Icon",
    early_adopter: "Early Adopter",
  };
  const label = BADGE_LABELS[badgeKey] || badgeKey;
  await sb.from("notifications").insert({
    user_id: userId, type: "badge_awarded",
    title: `You earned the "${label}" badge! 🏆`,
    link_type: "profile", link_id: userId,
  }).then(() => null, () => null);
}

// POST /api/badges/check — trigger badge evaluation for authed user
communityRouter.post("/badges/check", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await checkAndAwardBadges(user.id);
  const { data } = await sb!.from("user_badges").select("*").eq("user_id", user.id);
  res.json(data ?? []);
});

async function checkAndAwardBadges(userId: number) {
  if (!sb) return;
  const [{ count: sales }, { count: listings }, { count: guides }, { data: groups }, { count: followers }] =
    await Promise.all([
      sb.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "sold"),
      sb.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", userId),
      sb.from("guides").select("*", { count: "exact", head: true }).eq("author_id", userId),
      sb.from("group_members").select("role").eq("user_id", userId),
      sb.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    ]);

  const awards: string[] = [];
  if ((sales ?? 0) >= 1)    awards.push("first_sale");
  if ((sales ?? 0) >= 10)   awards.push("seller_10");
  if ((sales ?? 0) >= 50)   awards.push("seller_50");
  if ((sales ?? 0) >= 100)  awards.push("seller_100");
  if ((listings ?? 0) >= 1) awards.push("first_listing");
  if ((guides ?? 0) >= 1)   awards.push("guide_author");
  if ((guides ?? 0) >= 10)  awards.push("guide_10");
  if ((followers ?? 0) >= 10)  awards.push("follower_10");
  if ((followers ?? 0) >= 100) awards.push("follower_100");
  if ((followers ?? 0) >= 1000) awards.push("follower_1k");
  if (groups?.some((g: any) => g.role === "owner")) awards.push("group_founder");
  if (groups?.some((g: any) => ["owner", "admin"].includes(g.role))) awards.push("group_admin");

  for (const key of awards) await awardBadge(userId, key);
}

// ============================================================
// EVENTS
// ============================================================

// GET /api/events — list events (geo + vertical filter)
communityRouter.get("/events", async (req, res) => {
  const { vertical, group_id, upcoming = "true", limit: lim = "20" } = req.query;
  const limit = Math.min(Number(lim), 50);

  let q = sb!.from("events")
    .select("*, organizer:users!events_organizer_id_fkey(id,display_name,username,avatar), group:groups(id,name,cover_image)")
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (upcoming === "true") q = q.gte("starts_at", new Date().toISOString());
  if (vertical) q = q.eq("vertical", vertical as string);
  if (group_id) q = q.eq("group_id", group_id as string);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/events/:id
communityRouter.get("/events/:id", async (req, res) => {
  const { data, error } = await sb!.from("events")
    .select("*, organizer:users!events_organizer_id_fkey(id,display_name,username,avatar,creator_mode), group:groups(id,name,cover_image)")
    .eq("id", req.params.id).single();
  if (error || !data) return res.status(404).json({ error: "Event not found" });
  res.json(data);
});

// POST /api/events — create event
communityRouter.post("/events", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const fields = [
    "title", "description", "cover_image", "group_id", "vertical", "event_type",
    "starts_at", "ends_at", "timezone", "location_name", "address", "city",
    "state", "zip", "lat", "lng", "is_online", "online_url", "is_private", "capacity",
  ];
  const body = pick(req.body, fields as any);
  if (!body.title?.trim() || !body.starts_at) return res.status(400).json({ error: "title and starts_at required" });

  const { data, error } = await sb!.from("events")
    .insert({ ...body, organizer_id: user.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/events/:id
communityRouter.patch("/events/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: existing } = await sb!.from("events").select("organizer_id").eq("id", req.params.id).single();
  if (!existing || existing.organizer_id !== user.id) return res.status(403).json({ error: "Forbidden" });

  const allowed = ["title","description","cover_image","starts_at","ends_at","location_name","address","city","state","zip","lat","lng","is_online","online_url","capacity","vertical","event_type"];
  const { data, error } = await sb!.from("events")
    .update(pick(req.body, allowed as any)).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/events/:id
communityRouter.delete("/events/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: existing } = await sb!.from("events").select("organizer_id").eq("id", req.params.id).single();
  if (!existing || existing.organizer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
  await sb!.from("events").delete().eq("id", req.params.id);
  res.json({ success: true });
});

// POST /api/events/:id/rsvp
communityRouter.post("/events/:id/rsvp", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { status = "going" } = req.body;
  const validStatuses = ["going", "maybe", "not_going"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const { data, error } = await sb!.from("event_rsvps")
    .upsert({ event_id: Number(req.params.id), user_id: user.id, status }, { onConflict: "event_id,user_id" })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Notify organizer (fire & forget)
  if (status === "going") {
    sb!.from("events").select("organizer_id, title").eq("id", Number(req.params.id)).single()
      .then(({ data: ev }) => {
        if (ev && ev.organizer_id !== user.id) {
          sb!.from("notifications").insert({
            user_id: ev.organizer_id, type: "event_rsvp",
            title: `${user.displayName || "Someone"} is going to "${ev.title}"`,
            link_type: "event", link_id: Number(req.params.id), actor_id: user.id,
          }).then(() => {});
        }
      }).catch(() => {});
  }

  res.json(data);
});

// DELETE /api/events/:id/rsvp
communityRouter.delete("/events/:id/rsvp", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("event_rsvps").delete()
    .eq("event_id", Number(req.params.id)).eq("user_id", user.id);
  res.json({ success: true });
});

// GET /api/events/:id/rsvp — my RSVP status
communityRouter.get("/events/:id/rsvp", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await sb!.from("event_rsvps")
    .select("status").eq("event_id", Number(req.params.id)).eq("user_id", user.id).single();
  res.json({ status: data?.status || null });
});

// GET /api/events/:id/attendees
communityRouter.get("/events/:id/attendees", async (req, res) => {
  const { data, error } = await sb!.from("event_rsvps")
    .select("status, user:users!event_rsvps_user_id_fkey(id,display_name,username,avatar)")
    .eq("event_id", Number(req.params.id))
    .order("created_at", { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// ============================================================
// PROJECT JOURNALS
// ============================================================

// GET /api/projects — browse projects
communityRouter.get("/projects", async (req, res) => {
  const { vertical, user_id, limit: lim = "20", cursor } = req.query;
  const limit = Math.min(Number(lim), 50);

  let q = sb!.from("projects")
    .select("*, owner:users!projects_user_id_fkey(id,display_name,username,avatar,creator_mode,specialist_tags)")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (vertical) q = q.eq("vertical", vertical as string);
  if (user_id)  q = q.eq("user_id", user_id as string);
  if (cursor)   q = q.lt("updated_at", cursor as string);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/projects/:id
communityRouter.get("/projects/:id", async (req, res) => {
  const { data, error } = await sb!.from("projects")
    .select("*, owner:users!projects_user_id_fkey(id,display_name,username,avatar,creator_mode,specialist_tags,follower_count), item:user_items(id,title,vertical,item_data,images)")
    .eq("id", req.params.id).single();
  if (error || !data) return res.status(404).json({ error: "Project not found" });
  // Increment view count
  sb!.from("projects").update({ view_count: (data.view_count ?? 0) + 1 }).eq("id", req.params.id).then(() => {});
  res.json(data);
});

// POST /api/projects — create project
communityRouter.post("/projects", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { vertical = "automotive", title, description, cover_image, item_id, tags = [], is_public = true } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const { data, error } = await sb!.from("projects")
    .insert({ user_id: user.id, vertical, title: title.trim(), description, cover_image, item_id, tags, is_public })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/projects/:id
communityRouter.patch("/projects/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const allowed = ["title","description","cover_image","tags","status","is_public","vertical","item_id"];
  const { data, error } = await sb!.from("projects")
    .update(pick(req.body, allowed as any))
    .eq("id", req.params.id).eq("user_id", user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// DELETE /api/projects/:id
communityRouter.delete("/projects/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("projects").delete().eq("id", req.params.id).eq("user_id", user.id);
  res.json({ success: true });
});

// GET /api/projects/:id/updates
communityRouter.get("/projects/:id/updates", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string | undefined;
  let q = sb!.from("project_updates")
    .select("*")
    .eq("project_id", req.params.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/projects/:id/updates
communityRouter.post("/projects/:id/updates", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  // Verify ownership
  const { data: project } = await sb!.from("projects").select("user_id").eq("id", req.params.id).single();
  if (!project || project.user_id !== user.id) return res.status(403).json({ error: "Forbidden" });

  const { content, images = [], video_id, video_hls_url, video_thumbnail_url, parts_used = [], cost, mileage } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Content required" });

  const { data, error } = await sb!.from("project_updates").insert({
    project_id: Number(req.params.id), user_id: user.id,
    content: content.trim(), images,
    ...(video_id ? { video_id, video_hls_url, video_thumbnail_url } : {}),
    parts_used, cost, mileage,
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Notify project followers
  fireProjectFollowerNotification(Number(req.params.id), user.id, data.id).catch(() => {});
  res.status(201).json(data);
});

// DELETE /api/projects/:projectId/updates/:id
communityRouter.delete("/projects/:projectId/updates/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("project_updates")
    .delete().eq("id", req.params.id).eq("user_id", user.id);
  res.json({ success: true });
});

// POST /api/projects/:id/like
communityRouter.post("/projects/:id/like", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const projectId = Number(req.params.id);
  const { data: existing } = await sb!.from("project_likes")
    .select("project_id").eq("project_id", projectId).eq("user_id", user.id).single();

  if (existing) {
    await sb!.from("project_likes").delete().eq("project_id", projectId).eq("user_id", user.id);
    const { count } = await sb!.from("project_likes").select("*", { count: "exact", head: true }).eq("project_id", projectId);
    await sb!.from("projects").update({ like_count: count ?? 0 }).eq("id", projectId);
    return res.json({ liked: false, count });
  }
  await sb!.from("project_likes").insert({ project_id: projectId, user_id: user.id });
  const { count } = await sb!.from("project_likes").select("*", { count: "exact", head: true }).eq("project_id", projectId);
  await sb!.from("projects").update({ like_count: count ?? 0 }).eq("id", projectId);
  // Notify project owner (fire & forget)
  sb!.from("projects").select("user_id, title").eq("id", projectId).single()
    .then(({ data: proj }) => {
      if (proj && proj.user_id !== user.id) {
        sb!.from("notifications").insert({
          user_id: proj.user_id, type: "project_like",
          title: `${user.displayName || "Someone"} liked your project "${proj.title}"`,
          link_type: "project", link_id: projectId, actor_id: user.id,
        }).then(() => {});
      }
    }).catch(() => {});
  res.json({ liked: true, count });
});

// GET /api/projects/:id/liked
communityRouter.get("/projects/:id/liked", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await sb!.from("project_likes")
    .select("project_id").eq("project_id", Number(req.params.id)).eq("user_id", user.id).single();
  res.json({ liked: !!data });
});

// POST /api/projects/:id/follow — follow a project for update notifications
communityRouter.post("/projects/:id/follow", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("project_follows")
    .upsert({ project_id: Number(req.params.id), user_id: user.id }, { ignoreDuplicates: true });
  res.json({ following: true });
});

// DELETE /api/projects/:id/follow
communityRouter.delete("/projects/:id/follow", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  await sb!.from("project_follows")
    .delete().eq("project_id", Number(req.params.id)).eq("user_id", user.id);
  res.json({ following: false });
});

// GET /api/projects/:id/following
communityRouter.get("/projects/:id/following", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await sb!.from("project_follows")
    .select("project_id").eq("project_id", Number(req.params.id)).eq("user_id", user.id).single();
  res.json({ following: !!data });
});

// ============================================================
// VERTICAL INTERESTS
// ============================================================
communityRouter.get("/interests", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await sb!.from("user_vertical_interests").select("vertical").eq("user_id", user.id);
  res.json((data ?? []).map((r: any) => r.vertical));
});

communityRouter.put("/interests", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { verticals } = req.body;
  if (!Array.isArray(verticals)) return res.status(400).json({ error: "verticals must be an array" });

  // Replace all interests atomically
  await sb!.from("user_vertical_interests").delete().eq("user_id", user.id);
  if (verticals.length > 0) {
    await sb!.from("user_vertical_interests")
      .insert(verticals.map((v: string) => ({ user_id: user.id, vertical: v })));
  }
  res.json({ verticals });
});

// ============================================================
// INTERNAL HELPERS
// ============================================================

async function fireFollowersNotification(userId: number, type: string, postId: number) {
  if (!sb) return;
  const { data: followers } = await sb.from("user_follows")
    .select("follower_id").eq("following_id", userId);
  if (!followers?.length) return;

  const { data: author } = await sb.from("users")
    .select("display_name").eq("id", userId).single();
  const name = (author as any)?.display_name || "Someone";

  const notes = followers.map((f: any) => ({
    user_id: f.follower_id,
    type: "new_post",
    title: `${name} posted an update`,
    body: null,
    link_type: "post",
    link_id: postId,
    actor_id: userId,
  }));
  await sb.from("notifications").insert(notes);
}

async function fireProjectFollowerNotification(projectId: number, userId: number, updateId: number) {
  if (!sb) return;
  const [{ data: followers }, { data: project }, { data: author }] = await Promise.all([
    sb.from("project_follows").select("user_id").eq("project_id", projectId).neq("user_id", userId),
    sb.from("projects").select("title").eq("id", projectId).single(),
    sb.from("users").select("display_name").eq("id", userId).single(),
  ]);
  if (!followers?.length) return;
  const pTitle = (project as any)?.title || "a project";
  const aName  = (author as any)?.display_name || "Someone";
  const notes = followers.map((f: any) => ({
    user_id: f.user_id,
    type: "project_update",
    title: `${aName} posted a new update on "${pTitle}"`,
    link_type: "project",
    link_id: projectId,
    actor_id: userId,
  }));
  await sb.from("notifications").insert(notes);
}
