import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Users
  app.get("/api/users", (_req, res) => res.json(storage.listUsers()));
  app.get("/api/users/:id", (req, res) => {
    const user = storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  });
  app.get("/api/users/:id/reviews", (req, res) => {
    const reviews = storage.listReviewsForUser(Number(req.params.id));
    const enriched = reviews.map(r => ({
      ...r,
      reviewer: storage.getUser(r.reviewerId),
    }));
    return res.json(enriched);
  });

  // Listings
  app.get("/api/listings", (req, res) => {
    const { category, status } = req.query;
    const listings = storage.listListings({
      category: category as string,
      status: (status as string) || "active",
    });
    const enriched = listings.map(l => ({
      ...l,
      seller: storage.getUser(l.sellerId),
    }));
    return res.json(enriched);
  });
  app.get("/api/listings/:id", (req, res) => {
    const listing = storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    storage.updateListingViews(listing.id);
    return res.json({ ...listing, seller: storage.getUser(listing.sellerId) });
  });
  app.post("/api/listings/:id/save", (req, res) => {
    storage.saveListing(Number(req.params.id));
    return res.json({ success: true });
  });
  app.post("/api/listings", (req, res) => {
    const data = req.body;
    const listing = storage.createListing({
      ...data,
      sellerId: 1,
      createdAt: "Just now",
      status: "active",
    });
    return res.json(listing);
  });

  // Groups
  app.get("/api/groups", (req, res) => {
    const { category } = req.query;
    const groups = storage.listGroups(category as string);
    const enriched = groups.map(g => ({
      ...g,
      owner: storage.getUser(g.ownerId),
    }));
    return res.json(enriched);
  });
  app.get("/api/groups/:id", (req, res) => {
    const group = storage.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json({ ...group, owner: storage.getUser(group.ownerId) });
  });
  app.get("/api/groups/:id/posts", (req, res) => {
    const posts = storage.listPostsByGroup(Number(req.params.id));
    const enriched = posts.map(p => ({
      ...p,
      author: storage.getUser(p.authorId),
    }));
    return res.json(enriched);
  });

  return httpServer;
}
