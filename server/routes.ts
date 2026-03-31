import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { supabaseAdmin as supabaseAdminForRoutes } from "./supabase";
import { authRouter, requireAuth } from "./auth";
import { adminRouter, reportRouter } from "./admin";
import { adsRouter, adminAdsRouter } from "./ads";
import { businessRouter } from "./business";
import { uploadRouter } from "./upload";
import { videoRouter } from "./video";
import { communityRouter } from "./community";
import { affiliateRouter } from "./affiliate";
import { guideSeriesRouter } from "./guide-series";
import { sendEmail, listingExpiryWarningEmail, listingExpiredEmail, listingSoldConfirmEmail } from "./email";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============================================================
  // AUTH ROUTES
  // ============================================================
  app.use("/api/auth", authRouter);

  // ============================================================
  // UPLOAD ROUTES (Cloudflare Images)
  // ============================================================
  app.use("/api/upload", uploadRouter);
  app.use("/api/video", videoRouter);

  // ============================================================
  // ADMIN ROUTES
  // ============================================================
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/ads", adminAdsRouter);
  app.use("/api/ads", adsRouter);

  // ============================================================
  // BUSINESS PAGES
  // ============================================================
  app.use("/api/business", businessRouter);
  app.use("/api/community", communityRouter);
  app.use("/api/affiliate", affiliateRouter);
  app.use("/api/guide-series", guideSeriesRouter);
  app.use("/api/reports", reportRouter);

  // ============================================================
  // USERS
  // ============================================================
  // Bulk user list — admin only (not used by client, prevents mass data harvest)
  app.get("/api/users", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if ((currentUser as any).siteRole !== "site_admin" && (currentUser as any).siteRole !== "super_admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const users = await storage.listUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  });

  app.get("/api/users/:id/reviews", async (req, res) => {
    const reviews = await storage.listReviewsForUser(Number(req.params.id));
    const enriched = await Promise.all(reviews.map(async r => ({
      ...r,
      reviewer: await storage.getUser(r.reviewerId),
    })));
    return res.json(enriched);
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser || currentUser.id !== Number(req.params.id)) {
      return res.status(403).json({ error: "Not authorized to update this profile" });
    }
    const updated = await storage.updateUser(Number(req.params.id), req.body);
    return res.json(updated);
  });

  // ============================================================
  // LISTINGS
  // ============================================================
  app.get("/api/listings", async (req, res) => {
    const { category, status } = req.query;
    const listings = await storage.listListings({
      category: category as string,
      status: (status as string) || "active",
    });
    const enriched = await Promise.all(listings.map(async l => ({
      ...l,
      seller: await storage.getUser(l.sellerId),
    })));
    return res.json(enriched);
  });

  app.get("/api/listings/:id", async (req, res) => {
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    storage.updateListingViews(listing.id); // fire and forget
    const seller = await storage.getUser(listing.sellerId);
    return res.json({ ...listing, seller });
  });

  app.post("/api/listings/:id/save", requireAuth, async (req, res) => {
    const listingId = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    await storage.saveListing(listingId);
    // Notify seller
    const listing = await storage.getListing(listingId);
    if (listing && currentUser) {
      (storage as any).createNotification({
        userId: listing.sellerId,
        type: "listing_save",
        title: `${currentUser.displayName} saved your listing`,
        body: listing.title,
        linkType: "listing",
        linkId: listingId,
        actorId: currentUser.id,
      }).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.post("/api/listings", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to create a listing" });
    try {
      // Set expiry: vehicles 60 days, parts/general 30 days
      const listingType = req.body.listingType || "vehicle";
      const expiryDays = listingType === "vehicle" ? 60 : 30;
      const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();

      // Health score: count completeness signals
      const b = req.body;
      let health = 0;
      if (b.title?.trim())       health += 15;
      if (b.description?.length > 50) health += 20;
      if (b.images?.length >= 1)  health += 15;
      if (b.images?.length >= 5)  health += 10;
      if (b.price > 0)            health += 10;
      if (b.location?.trim())     health += 10;
      if (b.latitude)             health += 5;
      if (b.condition)            health += 5;
      if (b.year)                 health += 5;
      if (b.make?.trim())         health += 5;

      const listing = await storage.createListing({
        ...req.body,
        sellerId: currentUser.id,
        expiresAt,
        healthScore: Math.min(100, health),
      });
      // Keyword check (fire & forget) — flag if match
      import("./ads").then(({ checkKeywords }) => {
        const text = [req.body.title, req.body.description].filter(Boolean).join(" ");
        checkKeywords(text, "listing").then(kw => {
          if (kw.flagged) {
            supabaseAdminForRoutes.from("content_flags").insert({
              content_type: "listing", content_id: listing.id,
              reason: "keyword_match", keyword: kw.keyword, auto_action: kw.action,
            }).then(() => {});
          }
        });
      }).catch(() => {});
      // Badge: first listing
      import("./community").then(({ awardBadge }) => awardBadge(currentUser.id, "first_listing")).catch(() => {});
      return res.status(201).json(listing);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/listings/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (!currentUser || listing.sellerId !== currentUser.id) {
      return res.status(403).json({ error: "Not authorized to update this listing" });
    }
    const updated = await storage.updateListing(Number(req.params.id), req.body);
    return res.json(updated);
  });

  app.delete("/api/listings/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (!currentUser || listing.sellerId !== currentUser.id) {
      return res.status(403).json({ error: "Not authorized to delete this listing" });
    }
    await storage.deleteListing(Number(req.params.id));
    return res.json({ success: true });
  });

  // ── Refresh (relist) a listing — resets expiry + bumps to top ─
  app.post("/api/listings/:id/refresh", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const listingId = Number(req.params.id);
    const listing = await storage.getListing(listingId) as any;
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.sellerId !== currentUser.id) return res.status(403).json({ error: "Not your listing" });

    const expiryDays = listing.listingType === "vehicle" ? 60 : 30;
    const newExpiry = new Date(Date.now() + expiryDays * 86400000).toISOString();
    const now = new Date().toISOString();

    await supabaseAdminForRoutes.from("listings").update({
      status: "active",
      expires_at: newExpiry,
      refreshed_at: now,
      expiry_warned: false,
      expiry_warned2: false,
      bump_count: (listing.bumpCount || 0) + 1,
      // Reset created_at equivalent via updated_at so it surfaces at top
      created_at: now,
    }).eq("id", listingId);

    // Log refresh
    await supabaseAdminForRoutes.from("listing_refreshes").insert({
      listing_id: listingId,
      user_id: currentUser.id,
      action: req.body.action || "refresh",
      previous_expires_at: (listing as any).expiresAt,
      new_expires_at: newExpiry,
    }).catch(() => {});

    // Notify
    (storage as any).createNotification({
      userId: currentUser.id,
      type: "listing_refresh",
      title: "Listing refreshed — back to the top!",
      body: listing.title,
      linkType: "listing",
      linkId: listingId,
    }).catch(() => {});

    return res.json({ success: true, expiresAt: newExpiry });
  });

  // ── Mark listing as sold ──────────────────────────────────────
  app.post("/api/listings/:id/sold", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const listingId = Number(req.params.id);
    const listing = await storage.getListing(listingId) as any;
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.sellerId !== currentUser.id) return res.status(403).json({ error: "Not your listing" });

    await supabaseAdminForRoutes.from("listings").update({
      status: "sold",
      sold_at: new Date().toISOString(),
    }).eq("id", listingId);

    // Send sold confirmation email
    const seller = await storage.getUser(currentUser.id);
    if (seller?.email) {
      const { subject, html } = listingSoldConfirmEmail({
        userName: seller.displayName || seller.username || "there",
        listingTitle: listing.title,
        price: listing.price,
      });
      sendEmail(seller.email, subject, html).catch(() => {});
    }

    // Check + award badges asynchronously
    import("./community").then(({ awardBadge }) => {
      supabaseAdminForRoutes.from("listings").select("*", { count: "exact", head: true })
        .eq("seller_id", currentUser.id).eq("status", "sold")
        .then(({ count }) => {
          if ((count ?? 0) >= 1)   awardBadge(currentUser.id, "first_sale");
          if ((count ?? 0) >= 10)  awardBadge(currentUser.id, "seller_10");
          if ((count ?? 0) >= 50)  awardBadge(currentUser.id, "seller_50");
          if ((count ?? 0) >= 100) awardBadge(currentUser.id, "seller_100");
        });
    }).catch(() => {});

    return res.json({ success: true });
  });

  // ── GET my listings (with expiry + health data) ───────────────
  app.get("/api/my-listings", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { status } = req.query;
    let query = supabaseAdminForRoutes
      .from("listings")
      .select("*")
      .eq("seller_id", currentUser.id)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status as string);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  });

  // ── Expiry cron endpoint (called by scheduled task) ───────────
  // GET /api/listings/run-expiry — expire overdue + send warning emails
  app.post("/api/listings/run-expiry", async (req, res) => {
    // Basic token check to prevent public abuse
    const token = req.headers["x-cron-token"] || req.query.token;
    const secret = process.env.CRON_SECRET;
    // If no secret configured, only allow from localhost (Railway internal)
    if (secret) {
      if (token !== secret) return res.status(401).json({ error: "Unauthorized" });
    } else {
      const ip = req.ip || req.socket.remoteAddress || "";
      if (!ip.includes("127.0.0.1") && !ip.includes("::1") && !ip.includes("::ffff:127")) {
        return res.status(401).json({ error: "CRON_SECRET not configured" });
      }
    }

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString();
    const in3Days = new Date(now.getTime() + 3 * 86400000).toISOString();
    let expired = 0, warned7 = 0, warned3 = 0;

    // 1. Expire listings past their expires_at
    const { data: toExpire } = await supabaseAdminForRoutes
      .from("listings")
      .select("id, title, price, seller_id, listing_type")
      .eq("status", "active")
      .lt("expires_at", now.toISOString());

    for (const l of (toExpire || [])) {
      await supabaseAdminForRoutes.from("listings").update({ status: "expired" }).eq("id", l.id);
      expired++;

      const seller = await storage.getUser(l.seller_id);
      if (seller?.email) {
        const { subject, html } = listingExpiredEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
        });
        sendEmail(seller.email, subject, html).catch(() => {});
      }
      // In-app notification
      (storage as any).createNotification({
        userId: l.seller_id,
        type: "listing_expired",
        title: "Listing expired — refresh to relist",
        body: l.title,
        linkType: "listing",
        linkId: l.id,
      }).catch(() => {});
    }

    // 2. Warn at 7 days out (first warning)
    const { data: warn7 } = await supabaseAdminForRoutes
      .from("listings")
      .select("id, title, price, seller_id, expires_at")
      .eq("status", "active")
      .eq("expiry_warned", false)
      .lt("expires_at", in7Days);

    for (const l of (warn7 || [])) {
      const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - now.getTime()) / 86400000);
      if (daysLeft < 1) continue; // already handled above
      await supabaseAdminForRoutes.from("listings").update({ expiry_warned: true }).eq("id", l.id);
      warned7++;
      const seller = await storage.getUser(l.seller_id);
      if (seller?.email) {
        const { subject, html } = listingExpiryWarningEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
          daysLeft,
          expiresAt: l.expires_at,
        });
        sendEmail(seller.email, subject, html).catch(() => {});
      }
      (storage as any).createNotification({
        userId: l.seller_id,
        type: "listing_expiry_warning",
        title: `Your listing expires in ${daysLeft} days`,
        body: `Refresh "${l.title}" to keep it active`,
        linkType: "listing",
        linkId: l.id,
      }).catch(() => {});
    }

    // 3. Warn again at 3 days out (second warning)
    const { data: warn3 } = await supabaseAdminForRoutes
      .from("listings")
      .select("id, title, price, seller_id, expires_at")
      .eq("status", "active")
      .eq("expiry_warned", true)
      .eq("expiry_warned2", false)
      .lt("expires_at", in3Days);

    for (const l of (warn3 || [])) {
      const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - now.getTime()) / 86400000);
      if (daysLeft < 1) continue;
      await supabaseAdminForRoutes.from("listings").update({ expiry_warned2: true }).eq("id", l.id);
      warned3++;
      const seller = await storage.getUser(l.seller_id);
      if (seller?.email) {
        const { subject, html } = listingExpiryWarningEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
          daysLeft,
          expiresAt: l.expires_at,
        });
        sendEmail(seller.email, subject, html).catch(() => {});
      }
    }

    return res.json({ expired, warned7, warned3, processedAt: now.toISOString() });
  });

  // ============================================================
  // GROUPS
  // ============================================================
  app.get("/api/groups", async (req, res) => {
    const { category } = req.query;
    const currentUser = (req as any).currentUser;
    const groups = await storage.listGroups(category as string);

    // If the user is logged in, batch-fetch their memberships so the card
    // can show "View" instead of "Request" for groups they already belong to.
    let memberGroupIds = new Set<number>();
    if (currentUser) {
      const { data: memberships } = await supabaseAdminForRoutes
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUser.id);
      memberGroupIds = new Set((memberships || []).map((m: any) => m.group_id));
    }

    const enriched = await Promise.all(groups.map(async g => {
      // isMember: true when user is in group_members OR is the owner
      // (owner check is a fallback for groups created before the auto-insert was added)
      const isMember = memberGroupIds.has(g.id) || (currentUser?.id === g.ownerId);

      // Self-heal: if the owner isn't in group_members yet, insert them now (fire & forget)
      if (currentUser?.id === g.ownerId && !memberGroupIds.has(g.id)) {
        supabaseAdminForRoutes
          .from("group_members")
          .upsert({ user_id: g.ownerId, group_id: g.id, role: "owner" }, { onConflict: "user_id,group_id" })
          .then(() => null, () => null);
      }

      return {
        ...g,
        owner: await storage.getUser(g.ownerId),
        isMember,
      };
    }));
    return res.json(enriched);
  });

  // ⚠️ These MUST come before /api/groups/:id to avoid Express swallowing 'mine'/'suggested' as an id param

  // GET /api/groups/mine — groups the current user belongs to
  app.get("/api/groups/mine", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groups = await (storage as any).listGroupsForUser(currentUser.id);
    return res.json(groups);
  });

  // GET /api/groups/suggested — suggested groups based on category affinity
  app.get("/api/groups/suggested", async (req, res) => {
    const { categories, excludeIds } = req.query;
    const catList = categories ? (categories as string).split(",").filter(Boolean) : [];
    const excluded = excludeIds ? (excludeIds as string).split(",").map(Number) : [];
    let groups: any[] = [];
    if (catList.length > 0) {
      // Get groups from matching categories, interleaved
      const perCat = await Promise.all(
        catList.slice(0, 3).map(cat => storage.listGroups(cat))
      );
      const seen = new Set<number>();
      for (const catGroups of perCat) {
        for (const g of catGroups) {
          if (!seen.has(g.id) && !excluded.includes(g.id)) {
            seen.add(g.id);
            groups.push(g);
          }
        }
      }
    }
    // Pad with most popular groups if not enough
    if (groups.length < 6) {
      const popular = await storage.listGroups();
      for (const g of popular) {
        if (groups.length >= 6) break;
        if (!groups.find((x: any) => x.id === g.id) && !excluded.includes(g.id)) {
          groups.push(g);
        }
      }
    }
    return res.json(groups.slice(0, 6));
  });

  // GET /api/groups/:id/rules
  app.get("/api/groups/:id/rules", async (req, res) => {
    const rules = await (storage as any).listGroupRules(Number(req.params.id));
    return res.json(rules);
  });

  // PUT /api/groups/:id/rules — replace all rules (owner only)
  app.put("/api/groups/:id/rules", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id) return res.status(403).json({ error: "Only the group owner can set rules" });
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ error: "rules must be an array" });
    await (storage as any).setGroupRules(groupId, rules.filter((r: any) => r.title?.trim()));
    return res.json({ ok: true });
  });

  // POST /api/groups/:id/setup — save wizard results (owner only)
  app.post("/api/groups/:id/setup", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id) return res.status(403).json({ error: "Only the group owner can complete setup" });
    const { avatar, coverImage, rules } = req.body;
    // Save images
    await (storage as any).completeGroupSetup(groupId, { avatar, coverImage, setupComplete: true });
    // Save rules if provided
    if (Array.isArray(rules) && rules.length > 0) {
      await (storage as any).setGroupRules(groupId, rules.filter((r: any) => r.title?.trim()));
    }
    const updated = await storage.getGroup(groupId);
    return res.json(updated);
  });

  // GET /api/groups/:id
  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    const owner = await storage.getUser(group.ownerId);

    // Self-heal: if member_count is 0 but group_members has rows, resync.
    // This fixes groups created before the member_count increment was added.
    if ((group.memberCount ?? 0) === 0) {
      const { count } = await supabaseAdminForRoutes
        .from("group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", group.id);
      if (count && count > 0) {
        await supabaseAdminForRoutes
          .from("groups")
          .update({ member_count: count })
          .eq("id", group.id);
        (group as any).memberCount = count;
      }
    }

    return res.json({ ...group, owner });
  });

  // POST /api/groups — create a group
  app.post("/api/groups", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "You need to be signed in to create a group." });

    const { name, description, category } = req.body;

    // Friendly validation
    if (!name?.trim()) return res.status(400).json({ error: "Please enter a name for your group." });
    if (name.trim().length < 3) return res.status(400).json({ error: "Group name must be at least 3 characters." });
    if (name.trim().length > 60) return res.status(400).json({ error: "Group name can't be longer than 60 characters." });
    if (!description?.trim()) return res.status(400).json({ error: "Please add a description so people know what your group is about." });
    if (!category?.trim()) return res.status(400).json({ error: "Please select a category for your group." });

    // Check for duplicate name (case-insensitive)
    const existing = await storage.listGroups();
    const nameTaken = existing.some(g => g.name.toLowerCase() === name.trim().toLowerCase());
    if (nameTaken) return res.status(400).json({ error: `A group called "${name.trim()}" already exists. Try a different name.` });

    try {
      const group = await storage.createGroup({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        coverImage: req.body.coverImage || null,
        private: req.body.private || false,
        ownerId: currentUser.id,
      });
      return res.status(201).json(group);
    } catch (err: any) {
      console.error("Create group error (FULL):", err.message, err.stack);
      // Translate cryptic Supabase errors into friendly messages
      const msg = err.message || "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return res.status(400).json({ error: `A group with that name already exists. Try a different name.` });
      }
      if (msg.includes("foreign key") || msg.includes("violates")) {
        return res.status(400).json({ error: "Something went wrong linking your account. Please try again." });
      }
      if (msg.includes("column") || msg.includes("does not exist")) {
        return res.status(400).json({ error: `Database error: ${msg}` });
      }
      return res.status(400).json({ error: `Couldn't create the group: ${msg}` });
    }
  });

  // Join / leave group
  // Join (public groups) OR request to join (private groups)
  app.post("/api/groups/:id/join", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.private) {
      // Private group — create a join request with answers + risk scoring
      const { message, answers = [] } = req.body;

      // ── Risk scoring ─────────────────────────────────────
      // Low score = trustworthy, high score = suspicious
      let riskScore = 0;
      const riskFlags: string[] = [];

      // Account age (new accounts are higher risk)
      const accountCreated = new Date((currentUser as any).createdAt || Date.now());
      const ageDays = Math.floor((Date.now() - accountCreated.getTime()) / 86400000);
      if (ageDays < 1)  { riskScore += 40; riskFlags.push("account_less_than_1_day"); }
      else if (ageDays < 7)  { riskScore += 20; riskFlags.push("account_less_than_7_days"); }
      else if (ageDays < 30) { riskScore += 10; riskFlags.push("account_less_than_30_days"); }

      // No profile completeness
      if (!currentUser.avatar)      { riskScore += 5; riskFlags.push("no_avatar"); }
      if (!currentUser.bio)         { riskScore += 3; riskFlags.push("no_bio"); }
      if (!currentUser.location)    { riskScore += 2; riskFlags.push("no_location"); }
      if (!currentUser.displayName) { riskScore += 5; riskFlags.push("no_display_name"); }

      // Activity signals (more activity = more trustworthy)
      const { count: listingCount } = await supabaseAdminForRoutes
        .from("listings").select("id", { count: "exact", head: true }).eq("seller_id", currentUser.id);
      const { count: postCount } = await supabaseAdminForRoutes
        .from("posts").select("id", { count: "exact", head: true }).eq("author_id", currentUser.id);
      if ((listingCount || 0) > 0 || (postCount || 0) > 0) riskScore = Math.max(0, riskScore - 15);

      // Phone verified = trusted
      if ((currentUser as any).phoneVerified) { riskScore = Math.max(0, riskScore - 20); }

      // Empty answers on required questions
      const { data: questions } = await supabaseAdminForRoutes
        .from("group_questions").select("id, required").eq("group_id", groupId);
      const requiredIds = (questions || []).filter((q: any) => q.required).map((q: any) => q.id);
      const answeredIds = answers.filter((a: any) => a.answer?.trim()).map((a: any) => a.questionId);
      const missingRequired = requiredIds.filter((id: number) => !answeredIds.includes(id));
      if (missingRequired.length > 0) {
        return res.status(400).json({ error: "Please answer all required questions" });
      }

      await (storage as any).requestJoinGroup(groupId, currentUser.id, message);

      // Store answers + risk score on the join request row
      if (answers.length > 0 || riskScore > 0) {
        await supabaseAdminForRoutes.from("group_join_requests")
          .update({ answers: JSON.stringify(answers), risk_score: riskScore, risk_flags: JSON.stringify(riskFlags) })
          .eq("group_id", groupId).eq("user_id", currentUser.id);
      }

      // Notify owner
      (storage as any).createNotification({
        userId: group.ownerId,
        type: "join_request",
        title: `${currentUser.displayName} requested to join ${group.name}`,
        body: message || null,
        linkType: "group",
        linkId: groupId,
        actorId: currentUser.id,
      }).catch(() => {});
      return res.json({ requested: true, riskScore });
    }

    // Public group — instant join
    await storage.joinGroup(groupId, currentUser.id);
    if (group.ownerId !== currentUser.id) {
      (storage as any).createNotification({
        userId: group.ownerId,
        type: "group_join",
        title: `${currentUser.displayName} joined your group`,
        body: group.name,
        linkType: "group",
        linkId: groupId,
        actorId: currentUser.id,
      }).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.post("/api/groups/:id/leave", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await storage.leaveGroup(Number(req.params.id), currentUser.id);
    return res.json({ success: true });
  });

  // ── Group membership questions ─────────────────────────────

  // GET /api/groups/:id/questions — public (anyone can see questions before joining)
  app.get("/api/groups/:id/questions", async (req, res) => {
    const { data } = await supabaseAdminForRoutes
      .from("group_questions")
      .select("id, question, required, sort_order")
      .eq("group_id", Number(req.params.id))
      .order("sort_order", { ascending: true });
    return res.json(data || []);
  });

  // PUT /api/groups/:id/questions — replace all questions (owner only)
  app.put("/api/groups/:id/questions", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id && (currentUser as any).siteRole !== 'super_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    const questions: { question: string; required?: boolean }[] = req.body.questions || [];
    if (questions.length > 5) return res.status(400).json({ error: "Maximum 5 questions allowed" });

    // Delete existing and re-insert
    await supabaseAdminForRoutes.from("group_questions").delete().eq("group_id", groupId);
    if (questions.length > 0) {
      await supabaseAdminForRoutes.from("group_questions").insert(
        questions.map((q, i) => ({
          group_id: groupId,
          question: q.question.trim(),
          required: q.required !== false,
          sort_order: i,
        }))
      );
    }
    return res.json({ success: true });
  });

  // Enhanced join: accepts question answers + computes risk score
  // Override the existing POST /api/groups/:id/join above with a smarter version
  // (existing route stays — this adds answer handling on top)

  // Cancel a pending join request
  app.delete("/api/groups/:id/join-request", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).cancelJoinRequest(Number(req.params.id), currentUser.id);
    return res.json({ success: true });
  });

  // GET join request status for current user
  app.get("/api/groups/:id/join-request", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const status = await (storage as any).getJoinRequestStatus(Number(req.params.id), currentUser.id);
    return res.json({ status });
  });

  // GET pending join requests (owner only)
  app.get("/api/groups/:id/join-requests", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const group = await storage.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id && (currentUser as any).siteRole !== 'super_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    const requests = await (storage as any).listPendingJoinRequests(Number(req.params.id));
    return res.json(requests);
  });

  // Approve a join request (owner only)
  app.post("/api/groups/:id/join-requests/:userId/approve", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id && (currentUser as any).siteRole !== 'super_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    await (storage as any).approveJoinRequest(groupId, userId, currentUser.id);
    // Notify the requester
    (storage as any).createNotification({
      userId,
      type: "join_approved",
      title: `Your request to join ${group.name} was approved!`,
      linkType: "group",
      linkId: groupId,
      actorId: currentUser.id,
    }).catch(() => {});
    return res.json({ success: true });
  });

  // Deny a join request (owner only)
  app.post("/api/groups/:id/join-requests/:userId/deny", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.ownerId !== currentUser.id && (currentUser as any).siteRole !== 'super_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    await (storage as any).denyJoinRequest(groupId, userId);
    // Notify the requester
    (storage as any).createNotification({
      userId,
      type: "join_denied",
      title: `Your request to join ${group.name} was not approved`,
      linkType: "group",
      linkId: groupId,
      actorId: currentUser.id,
    }).catch(() => {});
    return res.json({ success: true });
  });

  // Check membership
  app.get("/api/groups/:id/membership", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const isMember = await storage.isMember(groupId, currentUser.id);
    // Also return role
    let role: string | null = null;
    if (isMember) {
      const { data: membership } = await supabaseAdminForRoutes
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", currentUser.id)
        .single();
      role = membership?.role || "member";
    }
    const isSuperAdmin = (currentUser as any).siteRole === "super_admin";
    return res.json({ isMember, role, isSuperAdmin });
  });

  // ── Admin invite a user directly into the group ───────────────
  // POST /api/groups/:id/invite — owner/admin adds a user as member directly
  app.post("/api/groups/:id/invite", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", groupId).eq("user_id", currentUser.id).single();
    const isGroupAdmin = ["owner", "admin"].includes(mem?.role || "");

    if (!isGroupAdmin && !isSiteAdmin) {
      return res.status(403).json({ error: "Only group admins can invite members" });
    }

    // Check if already a member
    const { data: existing } = await supabaseAdminForRoutes
      .from("group_members").select("user_id, role")
      .eq("group_id", groupId).eq("user_id", userId).single();
    if (existing) {
      return res.status(400).json({
        error: `User is already a member of this group (role: ${existing.role}). Refresh the Members tab to see them.`,
        alreadyMember: true,
      });
    }

    // Add directly as member
    await supabaseAdminForRoutes.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
    });

    // Increment member count
    const { data: g } = await supabaseAdminForRoutes
      .from("groups").select("member_count").eq("id", groupId).single();
    if (g) await supabaseAdminForRoutes.from("groups")
      .update({ member_count: (g.member_count || 0) + 1 }).eq("id", groupId);

    // Log it
    await supabaseAdminForRoutes.from("group_mod_logs" as any).insert({
      group_id: groupId,
      moderator_id: currentUser.id,
      action: "invite",
      target_user_id: userId,
      note: `Invited by ${currentUser.username || currentUser.id}`,
    }).catch(() => null);

    return res.json({ success: true });
  });

  // ── Update group settings ──────────────────────────────────
  app.patch("/api/groups/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const isSuperAdmin = (currentUser as any).siteRole === "super_admin";
    // Only owner, admins, or super_admin can update
    const { data: membership } = await supabaseAdminForRoutes
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", currentUser.id)
      .single();
    const myRole = membership?.role;
    if (group.ownerId !== currentUser.id && myRole !== "admin" && !isSuperAdmin) {
      return res.status(403).json({ error: "Not authorized to update this group" });
    }
    const allowed = ["name", "description", "private", "coverImage", "avatar"];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const updated = await storage.updateGroup(groupId, updates);
    if (!updated) {
      // Fetch the group fresh if updateGroup returned undefined
      const fresh = await storage.getGroup(groupId);
      return res.json(fresh || { id: groupId, ...updates });
    }
    return res.json(updated);
  });

  // ── Promote/demote group member role ─────────────────────────
  app.patch("/api/groups/:id/members/:userId/role", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const { role } = req.body;
    if (!["admin", "moderator", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be admin, moderator, or member." });
    }
    // Only owner or site super_admin can promote/demote
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const isSuperAdmin = (currentUser as any).siteRole === "super_admin";
    if (group.ownerId !== currentUser.id && !isSuperAdmin) {
      return res.status(403).json({ error: "Only the group owner can manage roles" });
    }
    // Can't demote the owner
    if (targetUserId === group.ownerId) {
      return res.status(400).json({ error: "Cannot change the owner's role" });
    }
    const { error } = await supabaseAdminForRoutes
      .from("group_members")
      .update({ role })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, role });
  });

  // ── Remove member from group ──────────────────────────────────
  app.delete("/api/groups/:id/members/:userId", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const isSuperAdmin = (currentUser as any).siteRole === "super_admin";
    if (group.ownerId !== currentUser.id && !isSuperAdmin) {
      return res.status(403).json({ error: "Only the group owner can remove members" });
    }
    if (targetUserId === group.ownerId) {
      return res.status(400).json({ error: "Cannot remove the group owner" });
    }
    await supabaseAdminForRoutes
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);
    res.json({ success: true });
  });

  // ── Delete group (owner only, with failsafes) ─────────────────
  // Failsafes:
  // 1. Only the group owner OR site super_admin can delete
  // 2. Requires confirmation string matching group name
  // 3. Reassigns any pending content to super_admin archive record
  // 4. Cannot be done by group admins/moderators — owner only
  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const { confirmName } = req.body;

    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isSuperAdmin = (currentUser as any).siteRole === "super_admin";

    // Failsafe 1: Only owner or super_admin
    if (group.ownerId !== currentUser.id && !isSuperAdmin) {
      return res.status(403).json({ error: "Only the group owner or a site administrator can delete this group" });
    }

    // Failsafe 2: Must confirm by typing group name
    if (!confirmName || confirmName.trim().toLowerCase() !== group.name.toLowerCase()) {
      return res.status(400).json({ error: `Please type the group name exactly to confirm deletion: "${group.name}"` });
    }

    // Failsafe 3: Log deletion to audit trail before deleting
    try {
      await supabaseAdminForRoutes.from("admin_logs" as any).insert({
        action: "group_deleted",
        actor_id: currentUser.id,
        target_type: "group",
        target_id: groupId,
        details: JSON.stringify({
          group_name: group.name,
          group_category: group.category,
          deleted_by: currentUser.id,
          deleted_by_super_admin: isSuperAdmin,
        }),
      }).catch(() => null); // non-blocking — delete proceeds even if log fails
    } catch {}

    // Cascade delete (Supabase FK ON DELETE CASCADE handles posts, members, etc.)
    const { error } = await supabaseAdminForRoutes
      .from("groups")
      .delete()
      .eq("id", groupId);

    if (error) return res.status(500).json({ error: `Could not delete group: ${error.message}` });
    res.json({ success: true });
  });

  // ============================================================
  // POSTS (group posts)
  // ============================================================
  app.get("/api/groups/:id/posts", async (req, res) => {
    const posts = await storage.listPostsByGroup(Number(req.params.id));
    const enriched = await Promise.all(posts.map(async (p: any) => {
      const base = { ...p, author: await storage.getUser(p.authorId) };
      if (p.guideId) {
        base.guide = await storage.getGuide(p.guideId);
      }
      return base;
    }));
    return res.json(enriched);
  });

  app.post("/api/groups/:id/posts", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to post" });
    try {
      const post = await (storage as any).createPost({
        groupId: Number(req.params.id),
        authorId: currentUser.id,
        content: req.body.content,
        images: req.body.images || [],
        guideId: req.body.guideId ? Number(req.body.guideId) : null,
        videoId:           req.body.videoId || null,
        videoHlsUrl:       req.body.videoHlsUrl || null,
        videoThumbnailUrl: req.body.videoThumbnailUrl || null,
      });
      // Increment group post_count
      const group = await storage.getGroup(Number(req.params.id));
      if (group) await storage.updateGroup(group.id, { postCount: (group.postCount || 0) + 1 } as any);
      // Enrich with guide if embedded
      let guide = null;
      if (post.guideId) guide = await storage.getGuide(post.guideId);
      return res.status(201).json({ ...post, author: currentUser, guide });
    } catch (err: any) {
      console.error("[POST group post error]", err.message);
      return res.status(400).json({ error: err.message || "Unknown error" });
    }
  });

  // ============================================================
  // POST / GROUP MODERATION ACTIONS
  // ============================================================

  // DELETE /api/posts/:id — author or group admin/owner can delete
  app.delete("/api/posts/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const { data: post } = await supabaseAdminForRoutes
      .from("posts").select("author_id, group_id").eq("id", postId).single();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const isAuthor = post.author_id === currentUser.id;

    // Check if user is group admin/owner/moderator
    let isGroupMod = false;
    if (post.group_id) {
      const { data: mem } = await supabaseAdminForRoutes
        .from("group_members").select("role")
        .eq("group_id", post.group_id).eq("user_id", currentUser.id).single();
      isGroupMod = ["owner", "admin", "moderator"].includes(mem?.role || "");
    }

    if (!isAuthor && !isGroupMod && !isSiteAdmin) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }

    await supabaseAdminForRoutes.from("posts").delete().eq("id", postId);

    // Decrement post count
    if (post.group_id) {
      const { data: g } = await supabaseAdminForRoutes
        .from("groups").select("post_count").eq("id", post.group_id).single();
      if (g) await supabaseAdminForRoutes.from("groups")
        .update({ post_count: Math.max(0, (g.post_count || 1) - 1) }).eq("id", post.group_id);
    }

    // Log moderation action
    if (isGroupMod && !isAuthor) {
      await supabaseAdminForRoutes.from("group_mod_logs" as any).insert({
        group_id: post.group_id,
        moderator_id: currentUser.id,
        action: "delete_post",
        target_user_id: post.author_id,
        target_post_id: postId,
        note: "Post deleted by moderator",
      }).catch(() => null);
    }

    return res.json({ success: true });
  });

  // PATCH /api/posts/:id — edit post content (author only)
  app.patch("/api/posts/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

    const { data: post } = await supabaseAdminForRoutes
      .from("posts").select("author_id").eq("id", postId).single();
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.author_id !== currentUser.id) {
      return res.status(403).json({ error: "You can only edit your own posts" });
    }
    const { data: updated } = await supabaseAdminForRoutes
      .from("posts").update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", postId).select().single();
    return res.json(updated);
  });

  // POST /api/posts/:id/pin — pin/unpin (group admin+ only)
  app.post("/api/posts/:id/pin", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const { pin = true } = req.body;

    const { data: post } = await supabaseAdminForRoutes
      .from("posts").select("group_id, is_pinned").eq("id", postId).single();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", post.group_id).eq("user_id", currentUser.id).single();
    const isGroupMod = ["owner", "admin", "moderator"].includes(mem?.role || "");

    if (!isGroupMod && !isSiteAdmin) {
      return res.status(403).json({ error: "Only moderators can pin posts" });
    }

    // Unpin any currently pinned post first (only one pinned post per group)
    if (pin) {
      await supabaseAdminForRoutes.from("posts")
        .update({ is_pinned: false }).eq("group_id", post.group_id).eq("is_pinned", true);
    }

    await supabaseAdminForRoutes.from("posts").update({ is_pinned: pin }).eq("id", postId);
    return res.json({ pinned: pin });
  });

  // POST /api/groups/:id/members/:userId/ban — ban member (group admin+ only)
  // Ban prevents the user from joining again or posting
  app.post("/api/groups/:id/members/:userId/ban", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const { reason, duration } = req.body; // duration in hours, null = permanent

    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", groupId).eq("user_id", currentUser.id).single();
    const isGroupMod = ["owner", "admin"].includes(mem?.role || "");

    if (!isGroupMod && !isSiteAdmin) {
      return res.status(403).json({ error: "Only admins can ban members" });
    }
    if (targetId === group.ownerId) {
      return res.status(400).json({ error: "Cannot ban the group owner" });
    }

    const expiresAt = duration
      ? new Date(Date.now() + duration * 3600000).toISOString() : null;

    // Remove from group first
    await supabaseAdminForRoutes.from("group_members")
      .delete().eq("group_id", groupId).eq("user_id", targetId);

    // Record ban
    await supabaseAdminForRoutes.from("group_bans" as any).upsert({
      group_id: groupId,
      user_id: targetId,
      banned_by: currentUser.id,
      reason: reason?.trim() || null,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }, { onConflict: "group_id,user_id" }).catch(() => null);

    // Log it
    await supabaseAdminForRoutes.from("group_mod_logs" as any).insert({
      group_id: groupId,
      moderator_id: currentUser.id,
      action: "ban",
      target_user_id: targetId,
      note: reason || "No reason given",
    }).catch(() => null);

    return res.json({ success: true });
  });

  // DELETE /api/groups/:id/members/:userId/ban — unban a member
  app.delete("/api/groups/:id/members/:userId/ban", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const targetId = Number(req.params.userId);

    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", groupId).eq("user_id", currentUser.id).single();
    const isGroupMod = ["owner", "admin"].includes(mem?.role || "");
    if (!isGroupMod && !isSiteAdmin) return res.status(403).json({ error: "Not authorized" });

    await supabaseAdminForRoutes.from("group_bans" as any)
      .delete().eq("group_id", groupId).eq("user_id", targetId);
    return res.json({ success: true });
  });

  // GET /api/groups/:id/bans — list banned members
  app.get("/api/groups/:id/bans", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", groupId).eq("user_id", currentUser.id).single();
    if (!["owner", "admin", "moderator"].includes(mem?.role || "") && !isSiteAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { data: bans } = await supabaseAdminForRoutes
      .from("group_bans" as any).select("*").eq("group_id", groupId)
      .order("created_at", { ascending: false });
    return res.json(bans || []);
  });

  // GET /api/groups/:id/mod-log — moderation activity log
  app.get("/api/groups/:id/mod-log", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    const { data: mem } = await supabaseAdminForRoutes
      .from("group_members").select("role")
      .eq("group_id", groupId).eq("user_id", currentUser.id).single();
    if (!["owner", "admin", "moderator"].includes(mem?.role || "") && !isSiteAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { data: logs } = await supabaseAdminForRoutes
      .from("group_mod_logs" as any).select("*").eq("group_id", groupId)
      .order("created_at", { ascending: false }).limit(100);
    return res.json(logs || []);
  });

  // PATCH /api/groups/:id/settings — extended settings (slow mode, auto-approve, etc.)
  app.patch("/api/groups/:id/settings", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const group = await storage.getGroup(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const isSiteAdmin = (currentUser as any).siteRole === "super_admin";
    if (group.ownerId !== currentUser.id && !isSiteAdmin) {
      return res.status(403).json({ error: "Owner only" });
    }
    const allowed = ["slow_mode_seconds", "auto_approve_members", "post_approval_required", "welcome_message"];
    const updates: any = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    const { data } = await supabaseAdminForRoutes.from("groups")
      .update(updates).eq("id", groupId).select().single();
    return res.json(data);
  });

  // POST /api/posts/:id/report — report a post within a group
  app.post("/api/posts/:id/report", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const { reason, description } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });

    const { data: post } = await supabaseAdminForRoutes
      .from("posts").select("group_id, author_id").eq("id", postId).single();
    if (!post) return res.status(404).json({ error: "Post not found" });

    await supabaseAdminForRoutes.from("reports").insert({
      reporter_id: currentUser.id,
      target_type: "post",
      target_id: postId,
      reason,
      description: description?.trim() || null,
    }).catch(() => null);

    return res.json({ success: true });
  });

  // POST /api/posts/:id/helped — toggle "this helped me" reaction
  app.post("/api/posts/:id/helped", requireAuth, async (req, res) => {
    const postId = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    try {
      const result = await (storage as any).togglePostHelped(postId, currentUser.id);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Like / unlike a post
  app.post("/api/posts/:id/like", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const result = await storage.likePost(postId, currentUser.id);
    // Notify post author if this is a new like
    if (result.liked) {
      const post = await storage.getPost(postId);
      if (post && post.authorId !== currentUser.id) {
        (storage as any).createNotification({
          userId: post.authorId,
          type: "post_like",
          title: `${currentUser.displayName} liked your post`,
          linkType: "group",
          linkId: post.groupId,
          actorId: currentUser.id,
        }).catch(() => {});
      }
    }
    return res.json(result);
  });

  // ============================================================
  // REVIEWS
  // ============================================================
  app.post("/api/reviews", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to leave a review" });
    try {
      const review = await storage.createReview({
        reviewerId: currentUser.id,
        revieweeId: req.body.revieweeId,
        listingId: req.body.listingId,
        rating: req.body.rating,
        comment: req.body.comment,
        type: req.body.type,
      });
      // Notify reviewee
      (storage as any).createNotification({
        userId: req.body.revieweeId,
        type: "review",
        title: `${currentUser.displayName} left you a ${req.body.rating}★ review`,
        body: req.body.comment?.slice(0, 100) || undefined,
        linkType: "profile",
        linkId: req.body.revieweeId,
        actorId: currentUser.id,
      }).catch(() => {});
      return res.status(201).json(review);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ============================================================
  // MESSAGING
  // ============================================================

  // GET /api/conversations — my inbox
  app.get("/api/conversations", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const convs = await storage.listConversations(currentUser.id);
    return res.json(convs);
  });

  // POST /api/conversations — start or open a conversation with a user
  app.post("/api/conversations", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const { otherUserId, listingId } = req.body;
    if (!otherUserId || currentUser.id === Number(otherUserId)) {
      return res.status(400).json({ error: "Invalid participant" });
    }
    try {
      const conv = await storage.getOrCreateConversation(
        currentUser.id,
        Number(otherUserId),
        listingId ? Number(listingId) : null
      );
      return res.json(conv);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/conversations/:id/messages — load thread
  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const convId = Number(req.params.id);
    const conv = await storage.getConversation(convId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    // Auth: only participants
    if (conv.participant1Id !== currentUser.id && conv.participant2Id !== currentUser.id) {
      return res.status(403).json({ error: "Not a participant" });
    }
    // Mark as read
    await storage.markMessagesRead(convId, currentUser.id);
    const messages = await storage.listMessages(convId);
    return res.json(messages);
  });

  // POST /api/conversations/:id/messages — send a message
  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const convId = Number(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message cannot be empty" });
    const conv = await storage.getConversation(convId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.participant1Id !== currentUser.id && conv.participant2Id !== currentUser.id) {
      return res.status(403).json({ error: "Not a participant" });
    }
    try {
      const message = await storage.sendMessage(convId, currentUser.id, content.trim());
      // Notify the other participant
      const recipientId = conv.participant1Id === currentUser.id ? conv.participant2Id : conv.participant1Id;
      (storage as any).createNotification({
        userId: recipientId,
        type: "message",
        title: `New message from ${currentUser.displayName}`,
        body: content.length > 60 ? content.slice(0, 60) + "..." : content,
        linkType: "message",
        linkId: convId,
        actorId: currentUser.id,
      }).catch(() => {});
      return res.status(201).json(message);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // GUIDES
  // ============================================================

  // GET /api/guides — list guides with optional filters
  app.get("/api/guides", async (req, res) => {
    const { category, difficulty, search, authorId, vertical, seriesId, businessPageId, groupId, sortBy } = req.query;

    // Smart author search: if a search term matches a username/display_name,
    // also include guides by those authors (e.g. typing "todd" finds Todd's guides).
    let resolvedAuthorId = authorId ? Number(authorId) : undefined;
    if (search && !resolvedAuthorId) {
      const q = `%${search}%`;
      const { data: matchedAuthors } = await supabaseAdminForRoutes
        .from("users")
        .select("id")
        .or(`username.ilike.${q},display_name.ilike.${q}`);
      if (matchedAuthors && matchedAuthors.length === 1) {
        // Only use author match if exactly one author matches — avoids over-broad results
        resolvedAuthorId = matchedAuthors[0].id;
      }
    }

    const guides = await storage.listGuides({
      category: category as string | undefined,
      difficulty: difficulty as string | undefined,
      search: search as string | undefined,
      authorId: resolvedAuthorId,
      vertical: vertical as string | undefined,
      seriesId: seriesId ? Number(seriesId) : undefined,
      businessPageId: businessPageId ? Number(businessPageId) : undefined,
      groupId: groupId ? Number(groupId) : undefined,
      sortBy: (sortBy as any) || "quality",
    });
    res.json(guides);
  });

  // GET /api/guides/:id — get a single guide
  app.get("/api/guides/:id", async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const guide = await storage.getGuide(id, currentUser?.id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });
    // Increment views (fire and forget)
    storage.incrementGuideViews(id).catch(() => {});
    return res.json(guide);
  });

  // POST /api/guides — create a new guide (vertical-aware)
  app.post("/api/guides", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const {
      title, description, difficulty, timeEstimate, category, tags, tools,
      parts, steps, coverImageId,
      vertical = "automotive",
      subjectData = {},
      vehicleMake, vehicleModel, vehicleYearStart, vehicleYearEnd, // legacy compat
      headerEmbedUrl, seriesId, seriesPosition,
      businessPageId, groupId,
    } = req.body;

    if (!title?.trim() || !description?.trim() || !difficulty || !timeEstimate) {
      return res.status(400).json({ error: "title, description, difficulty, and timeEstimate are required" });
    }

    // Merge legacy automotive fields into subjectData
    const merged = { ...subjectData };
    if (vehicleMake) merged.make = vehicleMake;
    if (vehicleModel) merged.model = vehicleModel;
    if (vehicleYearStart) merged.year_start = vehicleYearStart;
    if (vehicleYearEnd) merged.year_end = vehicleYearEnd;

    // Validate + resolve embed URL
    let embedType = null, resolvedEmbed = null;
    if (headerEmbedUrl) {
      const { extractEmbedUrl } = await import("./guide-scoring");
      const e = extractEmbedUrl(headerEmbedUrl);
      if (e.type) { embedType = e.type; resolvedEmbed = headerEmbedUrl; }
    }

    // Validate business page ownership
    if (businessPageId) {
      const { data: biz } = await supabaseAdminForRoutes.from("business_pages").select("owner_id").eq("id", businessPageId).single();
      if (!biz || biz.owner_id !== currentUser.id) return res.status(403).json({ error: "Not your business page" });
    }

    try {
      const guide = await storage.createGuide({
        title: title.trim(), description: description.trim(),
        vehicleMake: merged.make || "N/A",
        vehicleModel: merged.model || "N/A",
        vehicleYearStart: merged.year_start || "N/A",
        vehicleYearEnd: merged.year_end || "N/A",
        difficulty, timeEstimate,
        category: category || null,
        tags: Array.isArray(tags) ? tags : [],
        tools: Array.isArray(tools) ? tools : [],
        parts: Array.isArray(parts) ? parts : [],
        steps: Array.isArray(steps) ? steps : [],
        coverImageId: coverImageId || null,
        authorId: currentUser.id,
      });

      // Write V2 fields
      await supabaseAdminForRoutes.from("guides").update({
        vertical, subject_data: merged,
        header_embed_url: resolvedEmbed, header_embed_type: embedType,
        series_id: seriesId || null, series_position: seriesPosition || null,
        business_page_id: businessPageId || null, group_id: groupId || null,
      }).eq("id", guide.id);

      // Async: AI extraction + badges + follower notifications
      Promise.all([
        import("./parts-extractor").then(({ extractGuidePartsManifest }) => extractGuidePartsManifest(guide)).catch(() => {}),
        import("./community").then(({ awardBadge }) => awardBadge(currentUser.id, "guide_author")).catch(() => {}),
        notifyFollowersNewGuide(currentUser.id, guide.id, title.trim()).catch(() => {}),
        // If added to series, update series guide_count
        seriesId ? supabaseAdminForRoutes.from("guide_series").select("guide_count").eq("id", seriesId).single()
          .then(({ data: s }) => {
            if (s) supabaseAdminForRoutes.from("guide_series").update({ guide_count: (s.guide_count || 0) + 1 }).eq("id", seriesId).then(() => {});
          }) : Promise.resolve(),
      ]).catch(() => {});

      return res.status(201).json({ ...guide, vertical, subjectData: merged });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/guides/:id — update a guide (author only)
  app.patch("/api/guides/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const guide = await storage.getGuide(id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });
    if (guide.authorId !== currentUser.id && currentUser.siteRole !== 'super_admin' && currentUser.siteRole !== 'site_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    const updated = await storage.updateGuide(id, req.body);
    // Re-extract if steps changed (fire & forget)
    if (req.body.steps && updated) {
      import("./parts-extractor").then(({ extractGuidePartsManifest }) => {
        extractGuidePartsManifest(updated, { force: true }).catch(() => {});
      }).catch(() => {});
    }
    return res.json(updated);
  });

  // DELETE /api/guides/:id — delete a guide (author or admin)
  app.delete("/api/guides/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const guide = await storage.getGuide(id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });
    if (guide.authorId !== currentUser.id && currentUser.siteRole !== 'super_admin' && currentUser.siteRole !== 'site_admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    await storage.deleteGuide(id);
    return res.json({ ok: true });
  });

  // POST /api/guides/:id/like — toggle like
  app.post("/api/guides/:id/like", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const result = await storage.likeGuide(id, currentUser.id);
    // Notify guide author on new like
    if (result.liked) {
      const guide = await storage.getGuide(id);
      if (guide && guide.authorId !== currentUser.id) {
        (storage as any).createNotification({
          userId: guide.authorId,
          type: "guide_like",
          title: `${currentUser.displayName} liked your guide`,
          body: guide.title,
          linkType: "guide",
          linkId: id,
          actorId: currentUser.id,
        }).catch(() => {});
      }
    }
    return res.json(result);
  });

  // GET /api/guides/:id/comments — list comments
  app.get("/api/guides/:id/comments", async (req, res) => {
    const id = Number(req.params.id);
    const comments = await storage.listGuideComments(id);
    return res.json(comments);
  });

  // POST /api/guides/:id/comments — add a comment
  app.post("/api/guides/:id/comments", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Comment cannot be empty" });
    const comment = await storage.createGuideComment(id, currentUser.id, content.trim());
    // Notify guide author
    const guide = await storage.getGuide(id);
    if (guide && guide.authorId !== currentUser.id) {
      (storage as any).createNotification({
        userId: guide.authorId,
        type: "guide_comment",
        title: `${currentUser.displayName} commented on your guide`,
        body: content.length > 80 ? content.slice(0, 80) + "..." : content,
        linkType: "guide",
        linkId: id,
        actorId: currentUser.id,
      }).catch(() => {});
    }
    return res.status(201).json(comment);
  });

  // DELETE /api/guide-comments/:id — delete a comment
  app.delete("/api/guide-comments/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    await storage.deleteGuideComment(id);
    return res.json({ ok: true });
  });

  // POST /api/guides/:id/helped — "this guide helped me" (guide-level, distinct from post helped)
  app.post("/api/guides/:id/helped", requireAuth, async (req, res) => {
    const guideId = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ error: "Not found" });

    const { data: existing } = await supabaseAdminForRoutes
      .from("guide_helped").select("guide_id").eq("guide_id", guideId).eq("user_id", currentUser.id).single();

    if (existing) {
      await supabaseAdminForRoutes.from("guide_helped").delete().eq("guide_id", guideId).eq("user_id", currentUser.id);
      return res.json({ helped: false });
    }

    await supabaseAdminForRoutes.from("guide_helped").insert({ guide_id: guideId, user_id: currentUser.id });

    // Record quality signal (fire & forget)
    import("./guide-scoring").then(({ recordSignal }) => {
      const createdAt = (currentUser as any).createdAt || (currentUser as any).memberSince || null;
      recordSignal({
        guideId, guideAuthorId: guide.authorId, userId: currentUser.id,
        userCreatedAt: createdAt, signalType: "helped",
        ip: req.ip || "",
      });
    }).catch(() => {});

    // Notify author
    if (guide.authorId !== currentUser.id) {
      (storage as any).createNotification({
        userId: guide.authorId, type: "guide_helped",
        title: `${currentUser.displayName} said your guide helped them`,
        body: guide.title, linkType: "guide", linkId: guideId, actorId: currentUser.id,
      }).catch(() => {});
    }
    return res.json({ helped: true });
  });

  // GET /api/guides/:id/helped — did current user mark as helped?
  app.get("/api/guides/:id/helped", requireAuth, async (req, res) => {
    const { data } = await supabaseAdminForRoutes.from("guide_helped")
      .select("guide_id").eq("guide_id", Number(req.params.id)).eq("user_id", (req as any).currentUser.id).single();
    res.json({ helped: !!data });
  });

  // POST /api/guides/:id/signal — record a behavioral signal (step_complete, share, save, return_visit)
  app.post("/api/guides/:id/signal", requireAuth, async (req, res) => {
    const guideId = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const { signalType } = req.body;
    const validTypes = ["step_complete", "share", "save", "return_visit", "comment_quality"];
    if (!validTypes.includes(signalType)) return res.status(400).json({ error: "Invalid signal type" });

    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ error: "Not found" });

    const { recordSignal } = await import("./guide-scoring");
    const result = await recordSignal({
      guideId, guideAuthorId: guide.authorId, userId: currentUser.id,
      userCreatedAt: (currentUser as any).createdAt || null,
      signalType, ip: req.ip || "",
    });
    res.json(result);
  });

  // ── Group Guide Library ──────────────────────────────────────
  // GET /api/groups/:id/guides
  app.get("/api/groups/:id/guides", async (req, res) => {
    const { data } = await supabaseAdminForRoutes
      .from("group_guides")
      .select(`
        position, is_pinned, added_at,
        guide:guides(id, title, description, difficulty, time_estimate, cover_image_id,
          quality_score, community_verified, views, likes, vertical, subject_data,
          author:author_id(id, username, display_name, avatar))
      `)
      .eq("group_id", Number(req.params.id))
      .order("is_pinned", { ascending: false })
      .order("position", { ascending: true });
    res.json(data ?? []);
  });

  // POST /api/groups/:id/guides — add guide to group library
  app.post("/api/groups/:id/guides", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const { guideId } = req.body;
    if (!guideId) return res.status(400).json({ error: "guideId required" });

    // Must be group admin/owner or guide author
    const { data: membership } = await supabaseAdminForRoutes
      .from("group_members").select("role").eq("group_id", groupId).eq("user_id", currentUser.id).single();
    const guide = await storage.getGuide(guideId);
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    const isAuthor = guide?.authorId === currentUser.id;
    if (!isAdmin && !isAuthor) return res.status(403).json({ error: "Must be group admin or guide author" });

    const { count } = await supabaseAdminForRoutes.from("group_guides")
      .select("*", { count: "exact", head: true }).eq("group_id", groupId);

    const { error } = await supabaseAdminForRoutes.from("group_guides").insert({
      group_id: groupId, guide_id: guideId,
      added_by: currentUser.id, position: (count ?? 0) + 1,
    });
    if (error && error.code !== "23505") return res.status(400).json({ error: error.message });

    // Record marketplace_link signal if guide added by author
    if (isAuthor && guide) {
      import("./guide-scoring").then(({ recordSignal }) =>
        recordSignal({ guideId, guideAuthorId: guide.authorId, userId: currentUser.id,
          userCreatedAt: null, signalType: "marketplace_link", ip: req.ip || "" })
      ).catch(() => {});
    }
    res.json({ success: true });
  });

  // DELETE /api/groups/:id/guides/:guideId
  app.delete("/api/groups/:id/guides/:guideId", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const groupId = Number(req.params.id);
    const { data: m } = await supabaseAdminForRoutes.from("group_members").select("role").eq("group_id", groupId).eq("user_id", currentUser.id).single();
    if (!m || !(["owner", "admin"].includes(m.role))) return res.status(403).json({ error: "Admin only" });
    await supabaseAdminForRoutes.from("group_guides").delete().eq("group_id", groupId).eq("guide_id", Number(req.params.guideId));
    res.json({ success: true });
  });

  // ── Revenue Share Settings ────────────────────────────────────
  // GET /api/guides/revenue-settings — platform revenue share config
  app.get("/api/guides/revenue-settings", async (_req, res) => {
    const { data } = await supabaseAdminForRoutes.from("platform_settings").select("value").eq("key", "revenue_share").single();
    res.json(data?.value || {});
  });

  // GET /api/guides/:id/revenue — guide revenue stats (author only)
  app.get("/api/guides/:id/revenue", requireAuth, async (req, res) => {
    const guide = await storage.getGuide(Number(req.params.id));
    if (!guide) return res.status(404).json({ error: "Not found" });
    if (guide.authorId !== (req as any).currentUser.id) return res.status(403).json({ error: "Not your guide" });
    const { data } = await supabaseAdminForRoutes.from("guide_revenue").select("*").eq("guide_id", guide.id).order("month", { ascending: false }).limit(12);
    res.json(data ?? []);
  });

  // ── Listing → Guide linkage ───────────────────────────────────
  // PATCH /api/listings/:id/related-guide
  app.patch("/api/listings/:id/related-guide", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Not found" });
    if (listing.sellerId !== currentUser.id) return res.status(403).json({ error: "Not your listing" });
    const { guideId } = req.body;
    await supabaseAdminForRoutes.from("listings").update({ related_guide_id: guideId || null }).eq("id", listing.id);
    // Signal: marketplace linkage boosts guide score
    if (guideId) {
      const guide = await storage.getGuide(guideId);
      if (guide) {
        import("./guide-scoring").then(({ recordSignal }) =>
          recordSignal({ guideId, guideAuthorId: guide.authorId, userId: currentUser.id,
            userCreatedAt: null, signalType: "marketplace_link", ip: req.ip || "" })
        ).catch(() => {});
      }
    }
    res.json({ success: true });
  });

  // ============================================================
  // MARKETPLACE — RECOMMENDATIONS, SAVED SEARCHES, SAVED LISTS
  // ============================================================

  // Record a listing view (fire-and-forget, called from listing detail)
  app.post("/api/listings/:id/view", async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    const sessionId = req.headers["x-session-id"] as string || undefined;
    (storage as any).recordListingView(id, currentUser?.id, sessionId).catch(() => {});
    return res.json({ ok: true });
  });

  // GET /api/recommendations — personalized feed
  app.get("/api/recommendations", async (req, res) => {
    const currentUser = (req as any).currentUser;
    const sessionId = req.headers["x-session-id"] as string || undefined;
    const excludeIds = req.query.exclude ? (req.query.exclude as string).split(",").map(Number) : [];
    const recs = await (storage as any).getRecommendations(currentUser?.id, sessionId, excludeIds, 12);
    // Enrich with seller
    const enriched = await Promise.all(recs.map(async (l: any) => ({
      ...l, seller: l.sellerId ? await storage.getUser(l.sellerId) : null,
    })));
    return res.json(enriched);
  });

  // GET /api/recently-viewed
  app.get("/api/recently-viewed", async (req, res) => {
    const currentUser = (req as any).currentUser;
    const sessionId = req.headers["x-session-id"] as string || undefined;
    const listings = await (storage as any).getRecentlyViewed(currentUser?.id, sessionId, 8);
    const enriched = await Promise.all(listings.map(async (l: any) => ({
      ...l, seller: l.sellerId ? await storage.getUser(l.sellerId) : null,
    })));
    return res.json(enriched);
  });

  // GET /api/listings/:id/similar
  app.get("/api/listings/:id/similar", async (req, res) => {
    const similar = await (storage as any).getSimilarListings(Number(req.params.id), 6);
    const enriched = await Promise.all(similar.map(async (l: any) => ({
      ...l, seller: l.sellerId ? await storage.getUser(l.sellerId) : null,
    })));
    return res.json(enriched);
  });

  // ── Saved searches ──
  app.get("/api/saved-searches", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const searches = await (storage as any).listSavedSearches(currentUser.id);
    return res.json(searches);
  });

  app.post("/api/saved-searches", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { name, query, filters, notify } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const search = await (storage as any).createSavedSearch(currentUser.id, { name: name.trim(), query, filters: filters || {}, notify });
    return res.status(201).json(search);
  });

  app.patch("/api/saved-searches/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const updated = await (storage as any).updateSavedSearch(Number(req.params.id), currentUser.id, req.body);
    return res.json(updated);
  });

  app.delete("/api/saved-searches/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).deleteSavedSearch(Number(req.params.id), currentUser.id);
    return res.json({ ok: true });
  });

  // ── Saved lists ──
  app.get("/api/saved-lists", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const lists = await (storage as any).listSavedLists(currentUser.id);
    return res.json(lists);
  });

  app.post("/api/saved-lists", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const list = await (storage as any).createSavedList(currentUser.id, { name: name.trim(), emoji });
    return res.status(201).json(list);
  });

  app.delete("/api/saved-lists/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).deleteSavedList(Number(req.params.id), currentUser.id);
    return res.json({ ok: true });
  });

  app.get("/api/saved-lists/:id/items", requireAuth, async (req, res) => {
    const items = await (storage as any).getListItems(Number(req.params.id));
    return res.json(items);
  });

  app.post("/api/saved-lists/:id/items", requireAuth, async (req, res) => {
    const { listingId, note } = req.body;
    if (!listingId) return res.status(400).json({ error: "listingId required" });
    await (storage as any).addToList(Number(req.params.id), Number(listingId), note);
    return res.json({ ok: true });
  });

  app.delete("/api/saved-lists/:id/items/:listingId", requireAuth, async (req, res) => {
    await (storage as any).removeFromList(Number(req.params.id), Number(req.params.listingId));
    return res.json({ ok: true });
  });

  // Quick-add to watchlist (auto-creates watchlist if needed)
  app.post("/api/watchlist/toggle", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ error: "listingId required" });
    const watchlist = await (storage as any).getOrCreateWatchlist(currentUser.id);
    const { saved } = await (storage as any).isInAnyList(currentUser.id, Number(listingId));
    // Check specifically in watchlist
    const items = await (storage as any).getListItems(watchlist.id);
    const inWatchlist = items.some((i: any) => i.listingId === Number(listingId) || i.listing_id === Number(listingId));
    if (inWatchlist) {
      await (storage as any).removeFromList(watchlist.id, Number(listingId));
      return res.json({ saved: false, listId: watchlist.id });
    } else {
      await (storage as any).addToList(watchlist.id, Number(listingId));
      return res.json({ saved: true, listId: watchlist.id });
    }
  });

  // Check if listing is saved in any list
  app.get("/api/listings/:id/saved-status", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const status = await (storage as any).isInAnyList(currentUser.id, Number(req.params.id));
    return res.json(status);
  });

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // GET /api/notifications — list my notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const limit = Math.min(req.query.limit ? Number(req.query.limit) : 30, 50);
    const notifs = await (storage as any).listNotifications(currentUser.id, limit);
    return res.json(notifs);
  });

  // GET /api/notifications/unread-count
  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const count = await (storage as any).getUnreadCount(currentUser.id);
    return res.json({ count });
  });

  // PATCH /api/notifications/:id/read
  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).markNotificationRead(Number(req.params.id), currentUser.id);
    return res.json({ ok: true });
  });

  // POST /api/notifications/mark-all-read
  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).markAllNotificationsRead(currentUser.id);
    return res.json({ ok: true });
  });

  // DELETE /api/notifications/:id
  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await (storage as any).deleteNotification(Number(req.params.id), currentUser.id);
    return res.json({ ok: true });
  });

  // ============================================================
  // SEARCH
  // ============================================================

  // GET /api/search?q=... — global search across all entities
  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json({ listings: [], groups: [], guides: [], users: [], posts: [] });
    const results = await (storage as any).searchAll(q);
    return res.json(results);
  });

  // GET /api/search/listings — marketplace search with full filters
  app.get("/api/search/listings", async (req, res) => {
    const {
      q = "", category, condition, location, minPrice, maxPrice,
      sort, minYear, maxYear, make, model, minMileage, maxMileage,
      searchLat, searchLng, radiusMiles, datePosted,
    } = req.query;
    const results = await (storage as any).searchListings(q as string, {
      category: category as string | undefined,
      condition: condition as string | undefined,
      location: location as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minYear: minYear ? Number(minYear) : undefined,
      maxYear: maxYear ? Number(maxYear) : undefined,
      make: make as string | undefined,
      model: model as string | undefined,
      minMileage: minMileage ? Number(minMileage) : undefined,
      maxMileage: maxMileage ? Number(maxMileage) : undefined,
      sort: sort as string | undefined,
      searchLat: searchLat ? Number(searchLat) : undefined,
      searchLng: searchLng ? Number(searchLng) : undefined,
      radiusMiles: radiusMiles ? Number(radiusMiles) : undefined,
      datePosted: datePosted as string | undefined,
    });
    // Enrich with seller
    const enriched = await Promise.all(results.map(async (l: any) => ({
      ...l, seller: l.sellerId ? await storage.getUser(l.sellerId) : null,
    })));
    return res.json(enriched);
  });

  // GET /api/groups/:id/search/posts?q=... — search posts within a group
  app.get("/api/groups/:id/search/posts", async (req, res) => {
    const groupId = Number(req.params.id);
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);
    const results = await (storage as any).searchGroupPosts(groupId, q);
    return res.json(results);
  });

  // GET /api/groups/:id/members — full member list with role, sorted (followed first for auth users)
  app.get("/api/groups/:id/members", async (req, res) => {
    const groupId = Number(req.params.id);
    const currentUser = (req as any).currentUser;

    const { data: members } = await supabaseAdminForRoutes
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (!members?.length) return res.json([]);

    // Get followed user IDs if authenticated
    let followedIds: Set<number> = new Set();
    if (currentUser) {
      const { data: follows } = await supabaseAdminForRoutes
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", currentUser.id);
      followedIds = new Set((follows || []).map((f: any) => f.following_id));
    }

    // Enrich with user data
    const userIds = members.map((m: any) => m.user_id);
    const { data: users } = await supabaseAdminForRoutes
      .from("users")
      .select("id, username, display_name, avatar, verified, site_role")
      .in("id", userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    const enriched = members.map((m: any) => ({
      ...userMap.get(m.user_id),
      role: m.role,
      joinedAt: m.joined_at,
      isFollowed: followedIds.has(m.user_id),
    })).filter((m: any) => m.id);

    // Sort: owner first, then followed, then everyone else (alpha within groups)
    enriched.sort((a: any, b: any) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      if (a.isFollowed && !b.isFollowed) return -1;
      if (b.isFollowed && !a.isFollowed) return 1;
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      return (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
    });

    return res.json(enriched);
  });

  // GET /api/groups/:id/search/members?q=... — search members of a group
  app.get("/api/groups/:id/search/members", async (req, res) => {
    const groupId = Number(req.params.id);
    const q = (req.query.q as string || "").trim();
    const results = await (storage as any).searchGroupMembers(groupId, q || "");
    return res.json(results);
  });

  // ============================================================
  // COMMUNITY FEED
  // ============================================================

  // GET /api/feed?cursor=<timestamp>&limit=20
  // Returns posts from groups the user is a member of + followed users,
  // ordered by created_at desc, with cursor-based infinite scroll.
  app.get("/api/feed", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 40);

    try {
      // 1. Get groups the user is in
      const myGroups = await (storage as any).listGroupsForUser(currentUser.id) as any[];
      const groupIds: number[] = (myGroups || []).map((g: any) => g.id);

      // 2. Get users the current user follows
      const { data: follows } = await supabaseAdminForRoutes
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", currentUser.id);
      const followedIds: number[] = (follows || []).map((f: any) => f.following_id);

      // 3. Get business pages the user follows
      const { data: bizFollows } = await supabaseAdminForRoutes
        .from("business_follows")
        .select("page_id")
        .eq("user_id", currentUser.id);
      const followedPageIds: number[] = (bizFollows || []).map((f: any) => f.page_id);

      // 4. Query posts from groups + followed users + followed business pages
      // Only select columns that exist in the base migration.
      // Optional columns (guide_id, reaction_counts, etc.) are added via separate migrations
      // and fetched after the fact to avoid 500s from schema cache misses.
      const postSelect = [
        "id", "content", "images", "created_at", "likes",
        // author join — users table base columns only
        "author:author_id(id, username, display_name, avatar, verified)",
        // group join — use cover_image (the actual column name, not avatar)
        "group:group_id(id, name, cover_image, category, private)",
      ].join(", ");

      if (groupIds.length === 0 && followedIds.length === 0 && followedPageIds.length === 0) {
        // No content sources yet — show recent posts from public groups as discovery
        const { data: discoverPosts } = await supabaseAdminForRoutes
          .from("posts")
          .select(postSelect)
          .eq("groups.private", false)
          .order("created_at", { ascending: false })
          .limit(limit);
        return res.json({ posts: discoverPosts || [], nextCursor: null, isDiscovery: true });
      }

      let query = supabaseAdminForRoutes
        .from("posts")
        .select(postSelect)
        .order("created_at", { ascending: false })
        .limit(limit);

      // Build OR filter: posts from my groups OR by followed users OR from followed business pages
      const conditions: string[] = [];
      if (groupIds.length > 0) conditions.push(`group_id.in.(${groupIds.join(",")})`);
      if (followedIds.length > 0) conditions.push(`author_id.in.(${followedIds.join(",")})`);
      if (followedPageIds.length > 0) conditions.push(`business_page_id.in.(${followedPageIds.join(",")})`);
      if (conditions.length > 0) query = query.or(conditions.join(","));

      if (cursor) query = query.lt("created_at", cursor);

      const { data: posts, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      const nextCursor = posts && posts.length === limit
        ? posts[posts.length - 1].created_at
        : null;

      return res.json({ posts: posts || [], nextCursor, isDiscovery: false });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/feed/follow/:userId — follow a user
  app.post("/api/feed/follow/:userId", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const targetId = Number(req.params.userId);
    if (targetId === currentUser.id) return res.status(400).json({ error: "Cannot follow yourself" });

    const { error } = await supabaseAdminForRoutes
      .from("user_follows")
      .insert({ follower_id: currentUser.id, following_id: targetId });

    if (error && error.code !== "23505") return res.status(400).json({ error: error.message });

    // Notify the followed user + check follower milestone badges (fire & forget)
    Promise.all([
      supabaseAdminForRoutes.from("users")
        .select("display_name").eq("id", currentUser.id).single()
        .then(({ data: actor }) => {
          const name = (actor as any)?.display_name || "Someone";
          return supabaseAdminForRoutes.from("notifications").insert({
            user_id: targetId, type: "new_follower",
            title: `${name} started following you`,
            link_type: "profile", link_id: currentUser.id, actor_id: currentUser.id,
          });
        }),
      import("./community").then(({ awardBadge }) => {
        supabaseAdminForRoutes.from("user_follows")
          .select("*", { count: "exact", head: true }).eq("following_id", targetId)
          .then(({ count }) => {
            if ((count ?? 0) >= 10)   awardBadge(targetId, "follower_10");
            if ((count ?? 0) >= 100)  awardBadge(targetId, "follower_100");
            if ((count ?? 0) >= 1000) awardBadge(targetId, "follower_1k");
          });
      }),
    ]).catch(() => {});

    res.json({ success: true, following: true });
  });

  // DELETE /api/feed/follow/:userId — unfollow
  app.delete("/api/feed/follow/:userId", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await supabaseAdminForRoutes
      .from("user_follows")
      .delete()
      .eq("follower_id", currentUser.id)
      .eq("following_id", Number(req.params.userId));
    res.json({ success: true, following: false });
  });

  // GET /api/feed/follow-status/:userId
  app.get("/api/feed/follow-status/:userId", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { data } = await supabaseAdminForRoutes
      .from("user_follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", Number(req.params.userId))
      .single();
    res.json({ following: !!data });
  });

  // POST /api/posts/:id/react — add/change reaction
  app.post("/api/posts/:id/react", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);
    const { reaction = "like" } = req.body;
    const validReactions = ["like", "love", "haha", "wow", "helpful", "fire"];
    if (!validReactions.includes(reaction)) return res.status(400).json({ error: "Invalid reaction" });

    // Upsert reaction
    const { error } = await supabaseAdminForRoutes
      .from("post_reactions")
      .upsert({ post_id: postId, user_id: currentUser.id, reaction },
        { onConflict: "post_id,user_id" });

    if (error) return res.status(400).json({ error: error.message });

    // Recount reactions for this post
    const { data: counts } = await supabaseAdminForRoutes
      .from("post_reactions")
      .select("reaction")
      .eq("post_id", postId);

    const tally: Record<string, number> = {};
    for (const r of (counts || [])) {
      tally[r.reaction] = (tally[r.reaction] || 0) + 1;
    }

    await supabaseAdminForRoutes
      .from("posts")
      .update({ reaction_counts: tally, likes: Object.values(tally).reduce((a, b) => a + b, 0) })
      .eq("id", postId);

    // Notify post author on first reaction (fire & forget)
    supabaseAdminForRoutes.from("posts").select("author_id, profile_user_id").eq("id", postId).single()
      .then(({ data: p }) => {
        const ownerId = p?.author_id;
        if (ownerId && ownerId !== currentUser.id) {
          (storage as any).createNotification({
            userId: ownerId,
            type: "post_react",
            title: `${currentUser.displayName} reacted to your post`,
            linkType: p?.profile_user_id ? "profile" : "group",
            linkId: p?.profile_user_id || postId,
            actorId: currentUser.id,
          }).catch(() => {});
        }
      }).catch(() => {});

    res.json({ success: true, reactions: tally });
  });

  // DELETE /api/posts/:id/react — remove reaction
  app.delete("/api/posts/:id/react", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const postId = Number(req.params.id);

    await supabaseAdminForRoutes
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    const { data: counts } = await supabaseAdminForRoutes
      .from("post_reactions").select("reaction").eq("post_id", postId);
    const tally: Record<string, number> = {};
    for (const r of (counts || [])) tally[r.reaction] = (tally[r.reaction] || 0) + 1;

    await supabaseAdminForRoutes.from("posts")
      .update({ reaction_counts: tally, likes: Object.values(tally).reduce((a, b) => a + b, 0) })
      .eq("id", postId);

    res.json({ success: true, reactions: tally });
  });

  // GET /api/posts/:id/my-reaction
  app.get("/api/posts/:id/my-reaction", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const { data } = await supabaseAdminForRoutes
      .from("post_reactions")
      .select("reaction")
      .eq("post_id", Number(req.params.id))
      .eq("user_id", currentUser.id)
      .single();
    res.json({ reaction: data?.reaction || null });
  });

  // ============================================================
  // CONFIG (public, safe values only)
  // ============================================================
  app.get("/api/config", (_req, res) => {
    res.json({
      cfImagesUrl: process.env.CLOUDFLARE_IMAGES_URL || "",
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
      // Video feature flags (kill switch)
      videoEnabled: process.env.VIDEO_ENABLED !== "false",  // default ON, set VIDEO_ENABLED=false to kill
      videoGroupEnabled: process.env.VIDEO_GROUP_ENABLED !== "false",
      videoListingEnabled: process.env.VIDEO_LISTING_ENABLED !== "false",
      cfStreamEnabled: !!(process.env.CF_STREAM_TOKEN && process.env.CF_ACCOUNT_ID),
    });
  });

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}

// ─── Internal helper: notify followers when author publishes guide ───
async function notifyFollowersNewGuide(authorId: number, guideId: number, title: string) {
  const { supabaseAdmin: sb } = await import("./supabase");
  if (!sb) return;
  const { data: followers } = await sb.from("user_follows").select("follower_id").eq("following_id", authorId);
  if (!followers?.length) return;
  const { data: author } = await sb.from("users").select("display_name").eq("id", authorId).single();
  const name = (author as any)?.display_name || "Someone";
  const notes = followers.map((f: any) => ({
    user_id: f.follower_id, type: "new_guide",
    title: `${name} published a new guide`,
    body: title, link_type: "guide", link_id: guideId, actor_id: authorId,
  }));
  await sb.from("notifications").insert(notes).catch(() => {});
}
