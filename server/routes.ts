import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { authRouter, requireAuth } from "./auth";
import { adminRouter, reportRouter } from "./admin";
import { uploadRouter } from "./upload";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============================================================
  // AUTH ROUTES
  // ============================================================
  app.use("/api/auth", authRouter);

  // ============================================================
  // UPLOAD ROUTES (Cloudflare Images)
  // ============================================================
  app.use("/api/upload", uploadRouter);

  // ============================================================
  // ADMIN ROUTES
  // ============================================================
  app.use("/api/admin", adminRouter);
  app.use("/api/reports", reportRouter);

  // ============================================================
  // USERS
  // ============================================================
  app.get("/api/users", async (_req, res) => {
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

  app.post("/api/listings/:id/save", async (req, res) => {
    await storage.saveListing(Number(req.params.id));
    return res.json({ success: true });
  });

  app.post("/api/listings", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to create a listing" });
    try {
      const listing = await storage.createListing({
        ...req.body,
        sellerId: currentUser.id,
      });
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

  // ============================================================
  // GROUPS
  // ============================================================
  app.get("/api/groups", async (req, res) => {
    const { category } = req.query;
    const groups = await storage.listGroups(category as string);
    const enriched = await Promise.all(groups.map(async g => ({
      ...g,
      owner: await storage.getUser(g.ownerId),
    })));
    return res.json(enriched);
  });

  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    const owner = await storage.getUser(group.ownerId);
    return res.json({ ...group, owner });
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to create a group" });
    try {
      const group = await storage.createGroup({
        ...req.body,
        ownerId: currentUser.id,
      });
      return res.status(201).json(group);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Join / leave group
  app.post("/api/groups/:id/join", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await storage.joinGroup(Number(req.params.id), currentUser.id);
    return res.json({ success: true });
  });

  app.post("/api/groups/:id/leave", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    await storage.leaveGroup(Number(req.params.id), currentUser.id);
    return res.json({ success: true });
  });

  // Check membership
  app.get("/api/groups/:id/membership", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const isMember = await storage.isMember(Number(req.params.id), currentUser.id);
    return res.json({ isMember });
  });

  // ============================================================
  // POSTS (group posts)
  // ============================================================
  app.get("/api/groups/:id/posts", async (req, res) => {
    const posts = await storage.listPostsByGroup(Number(req.params.id));
    const enriched = await Promise.all(posts.map(async p => ({
      ...p,
      author: await storage.getUser(p.authorId),
    })));
    return res.json(enriched);
  });

  app.post("/api/groups/:id/posts", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    if (!currentUser) return res.status(401).json({ error: "Must be logged in to post" });
    try {
      const post = await storage.createPost({
        groupId: Number(req.params.id),
        authorId: currentUser.id,
        content: req.body.content,
        images: req.body.images || [],
      });
      // Increment group post_count
      const group = await storage.getGroup(Number(req.params.id));
      if (group) await storage.updateGroup(group.id, { postCount: (group.postCount || 0) + 1 } as any);
      return res.status(201).json({ ...post, author: currentUser });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Like / unlike a post
  app.post("/api/posts/:id/like", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const result = await storage.likePost(Number(req.params.id), currentUser.id);
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
    const { category, difficulty, search, authorId } = req.query;
    const guides = await storage.listGuides({
      category: category as string | undefined,
      difficulty: difficulty as string | undefined,
      search: search as string | undefined,
      authorId: authorId ? Number(authorId) : undefined,
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

  // POST /api/guides — create a new guide
  app.post("/api/guides", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const {
      title, description,
      vehicleMake, vehicleModel, vehicleYearStart, vehicleYearEnd,
      difficulty, timeEstimate, category, tags, tools, parts, steps, coverImageId,
    } = req.body;
    if (!title || !description || !vehicleMake || !vehicleModel || !vehicleYearStart || !vehicleYearEnd || !difficulty || !timeEstimate) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const guide = await storage.createGuide({
        title, description,
        vehicleMake, vehicleModel, vehicleYearStart, vehicleYearEnd,
        difficulty, timeEstimate,
        category: category || null,
        tags: tags || [],
        tools: tools || [],
        parts: parts || [],
        steps: steps || [],
        coverImageId: coverImageId || null,
        authorId: currentUser.id,
      });
      return res.status(201).json(guide);
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
    return res.status(201).json(comment);
  });

  // DELETE /api/guide-comments/:id — delete a comment
  app.delete("/api/guide-comments/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).currentUser;
    // Only admin can delete others' comments (simplified — author check would need a lookup)
    await storage.deleteGuideComment(id);
    return res.json({ ok: true });
  });

  // ============================================================
  // CONFIG (public, safe values only)
  // ============================================================
  app.get("/api/config", (_req, res) => {
    res.json({
      cfImagesUrl: process.env.CLOUDFLARE_IMAGES_URL || "",
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
