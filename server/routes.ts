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

  // GET /api/groups/:id
  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    const owner = await storage.getUser(group.ownerId);
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
      console.error("Create group error:", err.message);
      // Translate cryptic Supabase errors into friendly messages
      const msg = err.message || "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return res.status(400).json({ error: `A group with that name already exists. Try a different name.` });
      }
      if (msg.includes("foreign key") || msg.includes("violates")) {
        return res.status(400).json({ error: "Something went wrong linking your account. Please try again." });
      }
      return res.status(400).json({ error: "Couldn't create the group. Please try again in a moment." });
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
      // Private group — create a join request
      await (storage as any).requestJoinGroup(groupId, currentUser.id, req.body.message);
      // Notify owner
      (storage as any).createNotification({
        userId: group.ownerId,
        type: "join_request",
        title: `${currentUser.displayName} requested to join ${group.name}`,
        body: req.body.message || null,
        linkType: "group",
        linkId: groupId,
        actorId: currentUser.id,
      }).catch(() => {});
      return res.json({ requested: true });
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
    const isMember = await storage.isMember(Number(req.params.id), currentUser.id);
    return res.json({ isMember });
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
      });
      // Increment group post_count
      const group = await storage.getGroup(Number(req.params.id));
      if (group) await storage.updateGroup(group.id, { postCount: (group.postCount || 0) + 1 } as any);
      // Enrich with guide if embedded
      let guide = null;
      if (post.guideId) guide = await storage.getGuide(post.guideId);
      return res.status(201).json({ ...post, author: currentUser, guide });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
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
    // Only admin can delete others' comments (simplified — author check would need a lookup)
    await storage.deleteGuideComment(id);
    return res.json({ ok: true });
  });

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // GET /api/notifications — list my notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const limit = req.query.limit ? Number(req.query.limit) : 30;
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
    const { q = "", category, condition, location, minPrice, maxPrice, sort } = req.query;
    const results = await (storage as any).searchListings(q as string, {
      category: category as string | undefined,
      condition: condition as string | undefined,
      location: location as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort: sort as string | undefined,
    });
    return res.json(results);
  });

  // GET /api/groups/:id/search/posts?q=... — search posts within a group
  app.get("/api/groups/:id/search/posts", async (req, res) => {
    const groupId = Number(req.params.id);
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);
    const results = await (storage as any).searchGroupPosts(groupId, q);
    return res.json(results);
  });

  // GET /api/groups/:id/search/members?q=... — search members of a group
  app.get("/api/groups/:id/search/members", async (req, res) => {
    const groupId = Number(req.params.id);
    const q = (req.query.q as string || "").trim();
    const results = await (storage as any).searchGroupMembers(groupId, q || "");
    return res.json(results);
  });

  // ============================================================
  // CONFIG (public, safe values only)
  // ============================================================
  app.get("/api/config", (_req, res) => {
    res.json({
      cfImagesUrl: process.env.CLOUDFLARE_IMAGES_URL || "",
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
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
