import { Router } from "express";
import { supabaseAdmin } from "./supabase";
import { requireAuth } from "./auth";
import { requireAdmin, requireSuperAdmin } from "./admin";
import crypto from "crypto";

// ============================================================
// ADVERTISER ROUTER  — /api/ads
// ============================================================
export const adsRouter = Router();

// ── Helper: hash an IP for fraud detection (no PII stored) ───
function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + process.env.IP_SALT || "wg2026").digest("hex").slice(0, 16);
}

// ── Helper: keyword filter ────────────────────────────────────
export async function checkKeywords(text: string, contentType: string): Promise<{ blocked: boolean; flagged: boolean; keyword?: string; action?: string }> {
  const { data: rules } = await supabaseAdmin
    .from("keyword_blocklist")
    .select("*")
    .contains("applies_to", [contentType]);

  if (!rules?.length) return { blocked: false, flagged: false };

  const lower = text.toLowerCase();
  for (const rule of rules) {
    let match = false;
    if (rule.match_type === "exact") match = lower === rule.keyword.toLowerCase();
    else if (rule.match_type === "starts_with") match = lower.startsWith(rule.keyword.toLowerCase());
    else match = lower.includes(rule.keyword.toLowerCase());

    if (match) {
      return {
        blocked: rule.action === "block" || rule.action === "auto_reject",
        flagged: true,
        keyword: rule.keyword,
        action: rule.action,
      };
    }
  }
  return { blocked: false, flagged: false };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: Ad serving (no auth required)
// ─────────────────────────────────────────────────────────────

// GET /api/ads/serve?context=feed&interests=Cars,3DPrinting&groupId=5&limit=2
// context: "feed" | "marketplace" | "group" | "guides"
// interests: comma-separated interest tags (any topic, not just vehicles)
adsRouter.get("/serve", async (req, res) => {
  const { context = "feed", category, interests, groupId, limit = "2" } = req.query;
  const lim = Math.min(Number(limit), 5);

  // Accept both legacy "category" and new "interests" param
  const interestList: string[] = [
    ...(category ? [category as string] : []),
    ...(interests ? (interests as string).split(",").map(s => s.trim()).filter(Boolean) : []),
  ];

  // Build query for active ads matching targeting
  const { data: ads, error } = await supabaseAdmin
    .from("ads")
    .select(`
      id, name, headline, body, cta_text, cta_url,
      image_id, image_url, format, impressions, clicks,
      campaign:campaign_id(id, target_categories, target_interests, target_locations, target_group_ids, budget_amount, spent_amount, budget_type, bid_amount, bid_type, start_date, end_date),
      account:account_id(id, company_name)
    `)
    .eq("status", "active")
    .in("format", ["feed_card", "feed_post"]);

  if (error || !ads?.length) return res.json([]);

  // Filter by targeting criteria + budget not exhausted
  const now = new Date();
  const filtered = ads.filter((ad: any) => {
    const c = ad.campaign;
    if (!c) return false;
    // Date range
    if (c.start_date && new Date(c.start_date) > now) return false;
    if (c.end_date && new Date(c.end_date) < now) return false;
    // Budget
    if (c.budget_type === "total" && c.spent_amount >= c.budget_amount) return false;
    // Interest/category targeting (empty array = show to everyone)
    const campaignTargets = [...(c.target_categories || []), ...(c.target_interests || [])];
    if (interestList.length > 0 && campaignTargets.length > 0) {
      const overlap = interestList.some(i => campaignTargets.some(
        t => t.toLowerCase() === i.toLowerCase()
      ));
      if (!overlap) return false;
    }
    // Group targeting (empty = all groups)
    if (groupId && c.target_group_ids?.length && !c.target_group_ids.map(Number).includes(Number(groupId))) return false;
    return true;
  });

  if (!filtered.length) return res.json([]);

  // Weighted random selection (higher bid = more likely to show)
  const totalWeight = filtered.reduce((s: number, a: any) => s + (a.campaign?.bid_amount || 1), 0);
  const selected: any[] = [];
  const pool = [...filtered];

  for (let i = 0; i < lim && pool.length > 0; i++) {
    let r = Math.random() * pool.reduce((s: number, a: any) => s + (a.campaign?.bid_amount || 1), 0);
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].campaign?.bid_amount || 1;
      if (r <= 0) {
        selected.push(pool[j]);
        pool.splice(j, 1);
        break;
      }
    }
  }

  // Record impressions (fire & forget)
  const userIdHeader = req.headers["x-user-id"];
  const userId = userIdHeader ? Number(userIdHeader) : null;
  const ipHash = hashIp(req.ip || "unknown");

  Promise.all(selected.map(ad =>
    supabaseAdmin.from("ad_impressions").insert({
      ad_id: ad.id,
      campaign_id: ad.campaign?.id,
      account_id: ad.account?.id,
      user_id: userId,
      page_context: String(context),
      ip_hash: ipHash,
    }).then(() =>
      supabaseAdmin.from("ads").update({ impressions: ad.impressions + 1 }).eq("id", ad.id)
    )
  )).catch(() => {}); // non-blocking

  res.json(selected.map(ad => ({
    id: ad.id,
    headline: ad.headline,
    body: ad.body,
    ctaText: ad.cta_text,
    ctaUrl: ad.cta_url,
    imageId: ad.image_id,
    imageUrl: ad.image_url,
    advertiser: ad.account?.company_name,
    format: ad.format,
  })));
});

// POST /api/ads/:id/click — record a click
adsRouter.post("/:id/click", async (req, res) => {
  const adId = Number(req.params.id);
  const { data: ad } = await supabaseAdmin.from("ads").select("id, clicks, campaign_id, account_id").eq("id", adId).single();
  if (!ad) return res.status(404).json({ error: "Ad not found" });

  const userIdHeader = req.headers["x-user-id"];
  const userId = userIdHeader ? Number(userIdHeader) : null;
  const ipHash = hashIp(req.ip || "unknown");

  await Promise.all([
    supabaseAdmin.from("ad_clicks").insert({
      ad_id: adId,
      campaign_id: ad.campaign_id,
      account_id: ad.account_id,
      user_id: userId,
      ip_hash: ipHash,
      referrer: req.headers.referer || null,
    }),
    supabaseAdmin.from("ads").update({ clicks: ad.clicks + 1 }).eq("id", adId),
  ]);

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// ADVERTISER: Account + Campaign management (auth required)
// ─────────────────────────────────────────────────────────────

// GET /api/ads/account — get my ad account (or null)
adsRouter.get("/account", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data } = await supabaseAdmin
    .from("ad_accounts")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  res.json(data || null);
});

// POST /api/ads/account — create ad account
adsRouter.post("/account", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { companyName, website, description } = req.body;
  if (!companyName?.trim()) return res.status(400).json({ error: "Company name is required" });

  const { data: existing } = await supabaseAdmin
    .from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (existing) return res.status(400).json({ error: "You already have an ad account" });

  const { data, error } = await supabaseAdmin.from("ad_accounts").insert({
    owner_id: user.id,
    company_name: companyName.trim(),
    website: website || null,
    description: description || null,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/ads/account — update ad account
adsRouter.patch("/account", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { companyName, website, description } = req.body;
  const { data, error } = await supabaseAdmin
    .from("ad_accounts")
    .update({
      company_name: companyName,
      website,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/ads/campaigns — list my campaigns
adsRouter.get("/campaigns", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*, ads(id, status, impressions, clicks, headline)")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/ads/campaigns — create campaign
adsRouter.post("/campaigns", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id, status").eq("owner_id", user.id).single();
  if (!account) return res.status(400).json({ error: "Create an ad account first" });
  if (account.status === "suspended") return res.status(403).json({ error: "Your ad account is suspended" });

  const {
    name, objective, budgetType, budgetAmount, bidType, bidAmount,
    startDate, endDate, targetCategories, targetVehicleMakes,
    targetLocations, targetGroupIds,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "Campaign name is required" });
  if (!budgetAmount || Number(budgetAmount) < 1) return res.status(400).json({ error: "Minimum budget is $1" });

  const { data, error } = await supabaseAdmin.from("ad_campaigns").insert({
    account_id: account.id,
    name: name.trim(),
    objective: objective || "awareness",
    budget_type: budgetType || "daily",
    budget_amount: Number(budgetAmount),
    bid_type: bidType || "cpm",
    bid_amount: Number(bidAmount) || 2.00,
    start_date: startDate || null,
    end_date: endDate || null,
    target_categories: targetCategories || [],
    target_vehicle_makes: targetVehicleMakes || [],
    target_locations: targetLocations || [],
    target_group_ids: targetGroupIds || [],
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/ads/campaigns/:id
adsRouter.patch("/campaigns/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.status(403).json({ error: "No ad account" });

  const { data: campaign } = await supabaseAdmin
    .from("ad_campaigns").select("id, account_id, status").eq("id", req.params.id).single();
  if (!campaign || campaign.account_id !== account.id) return res.status(403).json({ error: "Not your campaign" });

  // Can only edit draft/paused campaigns
  if (!["draft", "paused"].includes(campaign.status)) {
    return res.status(400).json({ error: "Only draft or paused campaigns can be edited" });
  }

  const {
    name, budgetType, budgetAmount, bidType, bidAmount,
    startDate, endDate, targetCategories, targetVehicleMakes,
    targetLocations, targetGroupIds, status,
  } = req.body;

  const updates: any = { updated_at: new Date().toISOString() };
  if (name) updates.name = name;
  if (budgetType) updates.budget_type = budgetType;
  if (budgetAmount) updates.budget_amount = Number(budgetAmount);
  if (bidType) updates.bid_type = bidType;
  if (bidAmount) updates.bid_amount = Number(bidAmount);
  if (startDate !== undefined) updates.start_date = startDate;
  if (endDate !== undefined) updates.end_date = endDate;
  if (targetCategories !== undefined) updates.target_categories = targetCategories;
  if (targetVehicleMakes !== undefined) updates.target_vehicle_makes = targetVehicleMakes;
  if (targetLocations !== undefined) updates.target_locations = targetLocations;
  if (targetGroupIds !== undefined) updates.target_group_ids = targetGroupIds;
  // Allow advertiser to submit for review or pause
  if (status === "pending_review" || status === "paused") updates.status = status;

  const { data, error } = await supabaseAdmin.from("ad_campaigns").update(updates).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/ads/campaigns/:id
adsRouter.delete("/campaigns/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.status(403).json({ error: "No ad account" });
  const { data: campaign } = await supabaseAdmin.from("ad_campaigns").select("account_id").eq("id", req.params.id).single();
  if (!campaign || campaign.account_id !== account.id) return res.status(403).json({ error: "Not your campaign" });
  await supabaseAdmin.from("ad_campaigns").delete().eq("id", req.params.id);
  res.json({ success: true });
});

// ── Ads (creatives) ───────────────────────────────────────────

// GET /api/ads/campaigns/:id/ads
adsRouter.get("/campaigns/:id/ads", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.json([]);
  const { data } = await supabaseAdmin.from("ads")
    .select("*").eq("campaign_id", req.params.id).eq("account_id", account.id)
    .order("created_at", { ascending: false });
  res.json(data || []);
});

// POST /api/ads/campaigns/:id/ads
adsRouter.post("/campaigns/:id/ads", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.status(400).json({ error: "Create an ad account first" });

  const { headline, body, ctaText, ctaUrl, imageId, imageUrl, format } = req.body;
  if (!headline?.trim()) return res.status(400).json({ error: "Headline is required" });
  if (!ctaUrl?.trim()) return res.status(400).json({ error: "Destination URL is required" });

  // Keyword check
  const fullText = [headline, body, ctaText].filter(Boolean).join(" ");
  const kwCheck = await checkKeywords(fullText, "ad");
  if (kwCheck.blocked) {
    return res.status(400).json({ error: `Ad contains prohibited content: "${kwCheck.keyword}"` });
  }

  const { data, error } = await supabaseAdmin.from("ads").insert({
    campaign_id: Number(req.params.id),
    account_id: account.id,
    name: headline.trim().slice(0, 60),
    format: format || "feed_card",
    headline: headline.trim(),
    body: body || null,
    cta_text: ctaText || "Learn More",
    cta_url: ctaUrl.trim(),
    image_id: imageId || null,
    image_url: imageUrl || null,
    status: kwCheck.flagged ? "pending_review" : "pending_review", // always needs admin review
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  // Auto-flag if keyword match
  if (kwCheck.flagged) {
    await supabaseAdmin.from("content_flags").insert({
      content_type: "ad",
      content_id: data.id,
      reason: "keyword_match",
      keyword: kwCheck.keyword,
      auto_action: kwCheck.action,
    });
  }

  res.status(201).json(data);
});

// PATCH /api/ads/:id — edit an ad creative
adsRouter.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.status(403).json({ error: "No ad account" });
  const { data: ad } = await supabaseAdmin.from("ads").select("account_id").eq("id", req.params.id).single();
  if (!ad || ad.account_id !== account.id) return res.status(403).json({ error: "Not your ad" });

  const { headline, body, ctaText, ctaUrl, imageId, imageUrl } = req.body;
  const { data, error } = await supabaseAdmin.from("ads").update({
    headline, body, cta_text: ctaText, cta_url: ctaUrl,
    image_id: imageId, image_url: imageUrl,
    status: "pending_review", // re-review after edit
    updated_at: new Date().toISOString(),
  }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/ads/:id
adsRouter.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.status(403).json({ error: "No ad account" });
  const { data: ad } = await supabaseAdmin.from("ads").select("account_id").eq("id", req.params.id).single();
  if (!ad || ad.account_id !== account.id) return res.status(403).json({ error: "Not your ad" });
  await supabaseAdmin.from("ads").delete().eq("id", req.params.id);
  res.json({ success: true });
});

// ── Advertiser analytics ──────────────────────────────────────

// GET /api/ads/analytics?days=30
adsRouter.get("/analytics", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  const days = Number(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: account } = await supabaseAdmin.from("ad_accounts").select("id").eq("owner_id", user.id).single();
  if (!account) return res.json({ campaigns: [], totals: { impressions: 0, clicks: 0, ctr: 0, spend: 0 } });

  const { data: campaigns } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, name, status, spent_amount, budget_amount, budget_type")
    .eq("account_id", account.id);

  const { data: adStats } = await supabaseAdmin
    .from("ads")
    .select("id, headline, impressions, clicks, spend, status, campaign_id")
    .eq("account_id", account.id);

  const totalImpressions = adStats?.reduce((s: number, a: any) => s + a.impressions, 0) || 0;
  const totalClicks = adStats?.reduce((s: number, a: any) => s + a.clicks, 0) || 0;
  const totalSpend = adStats?.reduce((s: number, a: any) => s + Number(a.spend), 0) || 0;

  res.json({
    campaigns: campaigns || [],
    ads: adStats || [],
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00",
      spend: totalSpend.toFixed(2),
    },
  });
});

// ============================================================
// ADMIN ADS ROUTER  — /api/admin/ads
// ============================================================
export const adminAdsRouter = Router();
adminAdsRouter.use(requireAuth, requireAdmin);

// GET /api/admin/ads — list all ads pending review
adminAdsRouter.get("/", async (req, res) => {
  const { status = "pending_review", page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("ads")
    .select(`
      *, 
      campaign:campaign_id(id, name, budget_amount, budget_type, target_categories),
      account:account_id(id, company_name, owner_id, owner:owner_id(username, display_name))
    `, { count: "exact" })
    .eq("status", status as string)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ads: data, total: count, page: Number(page), limit });
});

// GET /api/admin/ads/campaigns — all campaigns
adminAdsRouter.get("/campaigns", async (req, res) => {
  const { status, page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  let query = supabaseAdmin
    .from("ad_campaigns")
    .select(`*, account:account_id(id, company_name, owner_id, owner:owner_id(username))`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status as string);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ campaigns: data, total: count, page: Number(page), limit });
});

// GET /api/admin/ads/accounts — all ad accounts
adminAdsRouter.get("/accounts", async (req, res) => {
  const { data } = await supabaseAdmin
    .from("ad_accounts")
    .select("*, owner:owner_id(id, username, display_name, email)")
    .order("created_at", { ascending: false });
  res.json(data || []);
});

// POST /api/admin/ads/:id/approve
adminAdsRouter.post("/:id/approve", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { data, error } = await supabaseAdmin.from("ads").update({
    status: "active",
    reviewed_by: adminUser.id,
    reviewed_at: new Date().toISOString(),
    rejection_reason: null,
  }).eq("id", req.params.id).select("campaign_id").single();

  if (error) return res.status(400).json({ error: error.message });

  // Activate campaign too if still in pending
  await supabaseAdmin.from("ad_campaigns")
    .update({ status: "active", reviewed_by: adminUser.id, reviewed_at: new Date().toISOString() })
    .eq("id", data.campaign_id)
    .eq("status", "pending_review");

  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id, action: "approve_ad",
    target_type: "ad", target_id: Number(req.params.id), notes: null,
  });

  res.json({ success: true });
});

// POST /api/admin/ads/:id/reject
adminAdsRouter.post("/:id/reject", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "Rejection reason is required" });

  await supabaseAdmin.from("ads").update({
    status: "rejected",
    rejection_reason: reason,
    reviewed_by: adminUser.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", req.params.id);

  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id, action: "reject_ad",
    target_type: "ad", target_id: Number(req.params.id), notes: reason,
  });

  res.json({ success: true });
});

// POST /api/admin/ads/:id/pause
adminAdsRouter.post("/:id/pause", async (req, res) => {
  const adminUser = (req as any).currentUser;
  await supabaseAdmin.from("ads").update({ status: "paused" }).eq("id", req.params.id);
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id, action: "pause_ad",
    target_type: "ad", target_id: Number(req.params.id), notes: req.body.reason || null,
  });
  res.json({ success: true });
});

// ── Keyword blocklist management ──────────────────────────────

// GET /api/admin/ads/keywords
adminAdsRouter.get("/keywords", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("keyword_blocklist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/admin/ads/keywords
adminAdsRouter.post("/keywords", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { keyword, matchType, action, appliesTo } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: "Keyword is required" });

  const { data, error } = await supabaseAdmin.from("keyword_blocklist").insert({
    keyword: keyword.trim().toLowerCase(),
    match_type: matchType || "contains",
    action: action || "flag",
    applies_to: appliesTo || ["listing", "post", "ad"],
    created_by: adminUser.id,
  }).select().single();

  if (error) {
    if (error.code === "23505") return res.status(400).json({ error: "Keyword already exists" });
    return res.status(400).json({ error: error.message });
  }
  res.status(201).json(data);
});

// DELETE /api/admin/ads/keywords/:id
adminAdsRouter.delete("/keywords/:id", async (req, res) => {
  await supabaseAdmin.from("keyword_blocklist").delete().eq("id", req.params.id);
  res.json({ success: true });
});

// ── Content flags queue ───────────────────────────────────────

// GET /api/admin/ads/flags
adminAdsRouter.get("/flags", async (req, res) => {
  const { status = "pending", page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("content_flags")
    .select("*", { count: "exact" })
    .eq("status", status as string)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ flags: data, total: count, page: Number(page), limit });
});

// PATCH /api/admin/ads/flags/:id
adminAdsRouter.patch("/flags/:id", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { status, notes } = req.body;

  await supabaseAdmin.from("content_flags").update({
    status,
    notes,
    reviewed_by: adminUser.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", req.params.id);

  res.json({ success: true });
});

// ── Admin revenue dashboard ───────────────────────────────────
adminAdsRouter.get("/revenue", async (_req, res) => {
  const [accounts, campaigns, totalAds, pendingAds] = await Promise.all([
    supabaseAdmin.from("ad_accounts").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("ads").select("id, spend"),
    supabaseAdmin.from("ads").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);

  const totalRevenue = (totalAds.data || []).reduce((s: number, a: any) => s + Number(a.spend), 0);

  res.json({
    totalAdAccounts: accounts.count ?? 0,
    activeAds: campaigns.count ?? 0,
    pendingAdsReview: pendingAds.count ?? 0,
    estimatedRevenue: totalRevenue.toFixed(2),
  });
});
