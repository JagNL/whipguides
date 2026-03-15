import { pgTable, text, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text().notNull().unique(),
  displayName: text().notNull(),
  avatar: text(),
  bio: text(),
  location: text(),
  memberSince: text().notNull(),
  rating: real().default(0),
  reviewCount: integer().default(0),
  verified: boolean().default(false),
  responseTime: text().default("Usually within a few hours"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Listings
export const listings = pgTable("listings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text().notNull(),
  price: integer().notNull(),
  category: text().notNull(),
  condition: text().notNull(),
  location: text().notNull(),
  year: integer(),
  make: text(),
  model: text(),
  mileage: integer(),
  images: text().array().default([]),
  sellerId: integer().notNull(),
  status: text().default("active"),
  views: integer().default(0),
  saves: integer().default(0),
  createdAt: text().notNull(),
  featured: boolean().default(false),
});

export const insertListingSchema = createInsertSchema(listings).omit({ id: true, views: true, saves: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;

// Groups
export const groups = pgTable("groups", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  description: text().notNull(),
  category: text().notNull(),
  coverImage: text(),
  memberCount: integer().default(0),
  postCount: integer().default(0),
  ownerId: integer().notNull(),
  private: boolean().default(false),
  createdAt: text().notNull(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, memberCount: true, postCount: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// Posts (group posts)
export const posts = pgTable("posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  groupId: integer().notNull(),
  authorId: integer().notNull(),
  content: text().notNull(),
  images: text().array().default([]),
  likes: integer().default(0),
  commentCount: integer().default(0),
  createdAt: text().notNull(),
});

export const insertPostSchema = createInsertSchema(posts).omit({ id: true, likes: true, commentCount: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Reviews
export const reviews = pgTable("reviews", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  reviewerId: integer().notNull(),
  revieweeId: integer().notNull(),
  listingId: integer(),
  rating: integer().notNull(),
  comment: text().notNull(),
  type: text().notNull(), // "buyer" | "seller"
  createdAt: text().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;
