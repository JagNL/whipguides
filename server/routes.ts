import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { authRouter, requireAuth } from "./auth";
import { adminRouter, reportRouter } from "./admin";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============================================================
  // AUTH ROUTES
  // ============================================================
  app.use("/api/auth", authRouter);

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
      return res.status(201).json({ ...post, author: currentUser });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
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
  // HEALTH CHECK
  // ============================================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
