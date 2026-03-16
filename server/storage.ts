import { supabaseAdmin, isSupabaseConfigured } from "./supabase";
import type {
  User, InsertUser,
  Listing, InsertListing,
  Group, InsertGroup,
  Post, InsertPost,
  Review, InsertReview,
} from "@shared/schema";

// ── Messaging types (not in Drizzle schema — raw Supabase) ──
export interface Conversation {
  id: number;
  participant1Id: number;
  participant2Id: number;
  listingId: number | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount1: number;
  unreadCount2: number;
  createdAt: string;
  // enriched
  otherUser?: User;
  listing?: Partial<Listing>;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  readAt: string | null;
  createdAt: string;
  sender?: User;
}

// ============================================================
// STORAGE INTERFACE
// ============================================================
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByAuthId(authId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { authId?: string; email?: string }): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  listUsers(): Promise<User[]>;

  // Listings
  getListing(id: number): Promise<Listing | undefined>;
  listListings(filters?: { category?: string; status?: string }): Promise<Listing[]>;
  createListing(listing: InsertListing): Promise<Listing>;
  updateListingViews(id: number): Promise<void>;
  saveListing(id: number): Promise<void>;
  updateListing(id: number, data: Partial<Listing>): Promise<Listing | undefined>;
  deleteListing(id: number): Promise<void>;

  // Groups
  getGroup(id: number): Promise<Group | undefined>;
  listGroups(category?: string): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;

  // Posts
  getPost(id: number): Promise<Post | undefined>;
  listPostsByGroup(groupId: number): Promise<Post[]>;
  createPost(post: InsertPost): Promise<Post>;

  // Reviews
  listReviewsForUser(userId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  // Messaging
  getOrCreateConversation(userA: number, userB: number, listingId?: number | null): Promise<Conversation>;
  listConversations(userId: number): Promise<Conversation[]>;
  listMessages(conversationId: number, limit?: number): Promise<Message[]>;
  sendMessage(conversationId: number, senderId: number, content: string): Promise<Message>;
  markMessagesRead(conversationId: number, userId: number): Promise<void>;
  getConversation(id: number): Promise<Conversation | undefined>;

  // Groups social
  joinGroup(groupId: number, userId: number): Promise<void>;
  leaveGroup(groupId: number, userId: number): Promise<void>;
  isMember(groupId: number, userId: number): Promise<boolean>;
  likePost(postId: number, userId: number): Promise<{ liked: boolean; likes: number }>;
  updateGroup(id: number, data: Partial<Group>): Promise<Group | undefined>;
}

// ============================================================
// SUPABASE STORAGE (production)
// ============================================================
export class SupabaseStorage implements IStorage {
  // Map camelCase schema fields to snake_case DB columns
  private mapUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar,
      bio: row.bio,
      location: row.location,
      memberSince: row.member_since,
      rating: row.rating,
      reviewCount: row.review_count,
      verified: row.verified,
      responseTime: row.response_time,
      // Admin fields
      siteRole: row.site_role || 'user',
      banned: row.banned || false,
    } as any;
  }

  private mapListing(row: any): Listing {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      category: row.category,
      condition: row.condition,
      location: row.location,
      year: row.year,
      make: row.make,
      model: row.model,
      mileage: row.mileage,
      images: row.images || [],
      sellerId: row.seller_id,
      status: row.status,
      views: row.views,
      saves: row.saves,
      createdAt: row.created_at,
      featured: row.featured,
    };
  }

  private mapGroup(row: any): Group {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      coverImage: row.cover_image,
      memberCount: row.member_count,
      postCount: row.post_count,
      ownerId: row.owner_id,
      private: row.private,
      createdAt: row.created_at,
    };
  }

  private mapPost(row: any): Post {
    return {
      id: row.id,
      groupId: row.group_id,
      authorId: row.author_id,
      content: row.content,
      images: row.images || [],
      likes: row.likes,
      commentCount: row.comment_count,
      createdAt: row.created_at,
    };
  }

  private mapReview(row: any): Review {
    return {
      id: row.id,
      reviewerId: row.reviewer_id,
      revieweeId: row.reviewee_id,
      listingId: row.listing_id,
      rating: row.rating,
      comment: row.comment,
      type: row.type,
      createdAt: row.created_at,
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    const { data } = await supabaseAdmin.from("users").select("*").eq("id", id).single();
    return data ? this.mapUser(data) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data } = await supabaseAdmin.from("users").select("*").eq("username", username).single();
    return data ? this.mapUser(data) : undefined;
  }

  async getUserByAuthId(authId: string): Promise<User | undefined> {
    const { data } = await supabaseAdmin.from("users").select("*").eq("auth_id", authId).single();
    return data ? this.mapUser(data) : undefined;
  }

  async createUser(user: InsertUser & { authId?: string; email?: string }): Promise<User> {
    const { data, error } = await supabaseAdmin.from("users").insert({
      username: user.username,
      display_name: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      member_since: user.memberSince || new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      verified: false,
      auth_id: user.authId,
      email: user.email,
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapUser(data);
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const updates: any = {};
    if (data.displayName) updates.display_name = data.displayName;
    if (data.avatar) updates.avatar = data.avatar;
    if (data.bio) updates.bio = data.bio;
    if (data.location) updates.location = data.location;
    if (data.rating !== undefined) updates.rating = data.rating;
    if (data.reviewCount !== undefined) updates.review_count = data.reviewCount;
    const { data: row } = await supabaseAdmin.from("users").update(updates).eq("id", id).select().single();
    return row ? this.mapUser(row) : undefined;
  }

  async listUsers(): Promise<User[]> {
    const { data } = await supabaseAdmin.from("users").select("*").limit(100);
    return (data || []).map(this.mapUser.bind(this));
  }

  async getListing(id: number): Promise<Listing | undefined> {
    const { data } = await supabaseAdmin.from("listings").select("*").eq("id", id).single();
    return data ? this.mapListing(data) : undefined;
  }

  async listListings(filters?: { category?: string; status?: string }): Promise<Listing[]> {
    let query = supabaseAdmin.from("listings").select("*").order("created_at", { ascending: false });
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.status) query = query.eq("status", filters.status);
    else query = query.eq("status", "active");
    const { data } = await query.limit(100);
    return (data || []).map(this.mapListing.bind(this));
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const { data, error } = await supabaseAdmin.from("listings").insert({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      condition: listing.condition,
      location: listing.location,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      mileage: listing.mileage,
      images: listing.images || [],
      seller_id: listing.sellerId,
      status: listing.status || "active",
      featured: listing.featured || false,
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapListing(data);
  }

  async updateListingViews(id: number): Promise<void> {
    await supabaseAdmin.rpc("increment_views", { listing_id: id }).catch(() => {
      // Fallback if RPC doesn't exist yet
      supabaseAdmin.from("listings").select("views").eq("id", id).single().then(({ data }) => {
        if (data) supabaseAdmin.from("listings").update({ views: (data.views || 0) + 1 }).eq("id", id);
      });
    });
  }

  async saveListing(id: number): Promise<void> {
    const { data } = await supabaseAdmin.from("listings").select("saves").eq("id", id).single();
    if (data) await supabaseAdmin.from("listings").update({ saves: (data.saves || 0) + 1 }).eq("id", id);
  }

  async updateListing(id: number, data: Partial<Listing>): Promise<Listing | undefined> {
    const updates: any = {};
    if (data.title) updates.title = data.title;
    if (data.description) updates.description = data.description;
    if (data.price !== undefined) updates.price = data.price;
    if (data.status) updates.status = data.status;
    if (data.images) updates.images = data.images;
    const { data: row } = await supabaseAdmin.from("listings").update(updates).eq("id", id).select().single();
    return row ? this.mapListing(row) : undefined;
  }

  async deleteListing(id: number): Promise<void> {
    await supabaseAdmin.from("listings").delete().eq("id", id);
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const { data } = await supabaseAdmin.from("groups").select("*").eq("id", id).single();
    return data ? this.mapGroup(data) : undefined;
  }

  async listGroups(category?: string): Promise<Group[]> {
    let query = supabaseAdmin.from("groups").select("*").order("member_count", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data } = await query.limit(50);
    return (data || []).map(this.mapGroup.bind(this));
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const { data, error } = await supabaseAdmin.from("groups").insert({
      name: group.name,
      description: group.description,
      category: group.category,
      cover_image: group.coverImage,
      owner_id: group.ownerId,
      private: group.private || false,
    }).select().single();
    if (error) throw new Error(error.message);
    // Auto-add owner as a member
    await supabaseAdmin.from("group_members").insert({
      user_id: group.ownerId,
      group_id: data.id,
      role: 'owner',
    }).select().single().catch(() => null);
    return this.mapGroup(data);
  }

  async updateGroup(id: number, data: Partial<Group>): Promise<Group | undefined> {
    const updates: any = {};
    if (data.name)        updates.name = data.name;
    if (data.description) updates.description = data.description;
    if (data.coverImage)  updates.cover_image = data.coverImage;
    const { data: row } = await supabaseAdmin.from("groups").update(updates).eq("id", id).select().single();
    return row ? this.mapGroup(row) : undefined;
  }

  async joinGroup(groupId: number, userId: number): Promise<void> {
    await supabaseAdmin.from("group_members").insert({
      user_id: userId,
      group_id: groupId,
      role: 'member',
    }).select().single().catch(() => null); // ignore duplicate
    // Increment member_count
    const { data } = await supabaseAdmin.from("groups").select("member_count").eq("id", groupId).single();
    if (data) await supabaseAdmin.from("groups").update({ member_count: (data.member_count || 0) + 1 }).eq("id", groupId);
  }

  async leaveGroup(groupId: number, userId: number): Promise<void> {
    await supabaseAdmin.from("group_members").delete().eq("user_id", userId).eq("group_id", groupId);
    const { data } = await supabaseAdmin.from("groups").select("member_count").eq("id", groupId).single();
    if (data) await supabaseAdmin.from("groups").update({ member_count: Math.max(0, (data.member_count || 1) - 1) }).eq("id", groupId);
  }

  async isMember(groupId: number, userId: number): Promise<boolean> {
    const { data } = await supabaseAdmin.from("group_members").select("user_id").eq("user_id", userId).eq("group_id", groupId).single();
    return !!data;
  }

  async likePost(postId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
    // Check if already liked
    const { data: existing } = await supabaseAdmin.from("post_likes").select("user_id").eq("user_id", userId).eq("post_id", postId).single();
    const { data: post } = await supabaseAdmin.from("posts").select("likes").eq("id", postId).single();
    const currentLikes = post?.likes || 0;
    if (existing) {
      // Unlike
      await supabaseAdmin.from("post_likes").delete().eq("user_id", userId).eq("post_id", postId);
      const newLikes = Math.max(0, currentLikes - 1);
      await supabaseAdmin.from("posts").update({ likes: newLikes }).eq("id", postId);
      return { liked: false, likes: newLikes };
    } else {
      // Like
      await supabaseAdmin.from("post_likes").insert({ user_id: userId, post_id: postId }).select().single().catch(() => null);
      const newLikes = currentLikes + 1;
      await supabaseAdmin.from("posts").update({ likes: newLikes }).eq("id", postId);
      return { liked: true, likes: newLikes };
    }
  }

  async getPost(id: number): Promise<Post | undefined> {
    const { data } = await supabaseAdmin.from("posts").select("*").eq("id", id).single();
    return data ? this.mapPost(data) : undefined;
  }

  async listPostsByGroup(groupId: number): Promise<Post[]> {
    const { data } = await supabaseAdmin.from("posts").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(50);
    return (data || []).map(this.mapPost.bind(this));
  }

  async createPost(post: InsertPost): Promise<Post> {
    const { data, error } = await supabaseAdmin.from("posts").insert({
      group_id: post.groupId,
      author_id: post.authorId,
      content: post.content,
      images: post.images || [],
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapPost(data);
  }

  async listReviewsForUser(userId: number): Promise<Review[]> {
    const { data } = await supabaseAdmin.from("reviews").select("*").eq("reviewee_id", userId).order("created_at", { ascending: false });
    return (data || []).map(this.mapReview.bind(this));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const { data, error } = await supabaseAdmin.from("reviews").insert({
      reviewer_id: review.reviewerId,
      reviewee_id: review.revieweeId,
      listing_id: review.listingId,
      rating: review.rating,
      comment: review.comment,
      type: review.type,
    }).select().single();
    if (error) throw new Error(error.message);
    // Update reviewee's average rating
    const { data: reviews } = await supabaseAdmin.from("reviews").select("rating").eq("reviewee_id", review.revieweeId);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
      await supabaseAdmin.from("users").update({ rating: Math.round(avg * 10) / 10, review_count: reviews.length }).eq("id", review.revieweeId);
    }
    return this.mapReview(data);
  }

  // ──────────────────────────────────────────────────────────
  // MESSAGING
  // ──────────────────────────────────────────────────────────

  private mapConversation(row: any): Conversation {
    return {
      id: row.id,
      participant1Id: row.participant1_id,
      participant2Id: row.participant2_id,
      listingId: row.listing_id,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount1: row.unread_count_1 || 0,
      unreadCount2: row.unread_count_2 || 0,
      createdAt: row.created_at,
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }

  async getOrCreateConversation(userA: number, userB: number, listingId?: number | null): Promise<Conversation> {
    const p1 = Math.min(userA, userB);
    const p2 = Math.max(userA, userB);
    // Try to find existing
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("participant1_id", p1)
      .eq("participant2_id", p2)
      .single();
    if (existing) return this.mapConversation(existing);
    // Create new
    const { data, error } = await supabaseAdmin.from("conversations").insert({
      participant1_id: p1,
      participant2_id: p2,
      listing_id: listingId || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapConversation(data);
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const { data } = await supabaseAdmin.from("conversations").select("*").eq("id", id).single();
    return data ? this.mapConversation(data) : undefined;
  }

  async listConversations(userId: number): Promise<Conversation[]> {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (!data) return [];
    // Enrich with other user
    const convs = data.map(this.mapConversation.bind(this));
    const enriched = await Promise.all(convs.map(async (c) => {
      const otherId = c.participant1Id === userId ? c.participant2Id : c.participant1Id;
      const otherUser = await this.getUser(otherId);
      let listing: Partial<Listing> | undefined;
      if (c.listingId) {
        const l = await this.getListing(c.listingId);
        if (l) listing = { id: l.id, title: l.title, images: l.images, price: l.price };
      }
      return { ...c, otherUser, listing };
    }));
    return enriched;
  }

  async listMessages(conversationId: number, limit = 100): Promise<Message[]> {
    const { data } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (!data) return [];
    const msgs = data.map(this.mapMessage.bind(this));
    // Enrich with sender
    return Promise.all(msgs.map(async (m) => ({
      ...m,
      sender: await this.getUser(m.senderId),
    })));
  }

  async sendMessage(conversationId: number, senderId: number, content: string): Promise<Message> {
    const { data, error } = await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    }).select().single();
    if (error) throw new Error(error.message);
    // Update conversation last_message + bump unread for the other participant
    const conv = await this.getConversation(conversationId);
    if (conv) {
      const isP1 = conv.participant1Id === senderId;
      await supabaseAdmin.from("conversations").update({
        last_message: content.length > 80 ? content.slice(0, 80) + "..." : content,
        last_message_at: new Date().toISOString(),
        unread_count_1: isP1 ? conv.unreadCount1 : conv.unreadCount1 + 1,
        unread_count_2: isP1 ? conv.unreadCount2 + 1 : conv.unreadCount2,
      }).eq("id", conversationId);
    }
    const msg = this.mapMessage(data);
    const sender = await this.getUser(senderId);
    return { ...msg, sender };
  }

  async markMessagesRead(conversationId: number, userId: number): Promise<void> {
    // Mark individual messages read
    await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .is("read_at", null);
    // Reset unread count for this user
    const conv = await this.getConversation(conversationId);
    if (conv) {
      const isP1 = conv.participant1Id === userId;
      await supabaseAdmin.from("conversations").update({
        unread_count_1: isP1 ? 0 : conv.unreadCount1,
        unread_count_2: isP1 ? conv.unreadCount2 : 0,
      }).eq("id", conversationId);
    }
  }
}

// ============================================================
// IN-MEMORY STORAGE FALLBACK (dev / no Supabase config)
// ============================================================
export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private listings: Map<number, Listing> = new Map();
  private groups: Map<number, Group> = new Map();
  private posts: Map<number, Post> = new Map();
  private reviews: Map<number, Review> = new Map();

  private userIdCounter = 1;
  private listingIdCounter = 1;
  private groupIdCounter = 1;
  private postIdCounter = 1;
  private reviewIdCounter = 1;

  constructor() {
    this.seed();
  }

  private seed() {
    const u1 = this.createUserSync({ username: "mikethrottle", displayName: "Mike Throttle", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike", bio: "Lifelong gearhead.", location: "Phoenix, AZ", memberSince: "Jan 2023", rating: 4.9, reviewCount: 47, verified: true, responseTime: "Within hours" });
    const u2 = this.createUserSync({ username: "sarahspeed", displayName: "Sarah Speed", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah", bio: "ATV racer.", location: "Denver, CO", memberSince: "Mar 2023", rating: 4.7, reviewCount: 23, verified: true, responseTime: "Same day" });
    const u3 = this.createUserSync({ username: "dirtbikejoe", displayName: "Joe Ramirez", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=joe", bio: "Weekend warrior.", location: "Austin, TX", memberSince: "Jun 2023", rating: 4.5, reviewCount: 12, verified: false, responseTime: "Within a day" });

    this.createListingSync({ title: "2022 Yamaha YZ450F — Race Ready", description: "Well-maintained race bike. Fresh top end, new chain/sprockets.", price: 8500, category: "Dirt Bikes", condition: "Excellent", location: "Phoenix, AZ", year: 2022, make: "Yamaha", model: "YZ450F", mileage: 42, images: [], sellerId: u1.id, status: "active", featured: true, createdAt: new Date().toISOString() });
    this.createListingSync({ title: "2021 Can-Am Maverick X3 Turbo", description: "Side-by-side in excellent condition. Full cage, light bar, winch.", price: 32000, category: "UTVs", condition: "Excellent", location: "Denver, CO", year: 2021, make: "Can-Am", model: "Maverick X3", mileage: 1200, images: [], sellerId: u2.id, status: "active", featured: true, createdAt: new Date().toISOString() });
    this.createListingSync({ title: "2020 Sea-Doo GTX 300 Jet Ski", description: "Low hours, garage kept. Includes trailer.", price: 14500, category: "Jet Skis", condition: "Good", location: "Austin, TX", year: 2020, make: "Sea-Doo", model: "GTX 300", mileage: 45, images: [], sellerId: u3.id, status: "active", featured: false, createdAt: new Date().toISOString() });
    this.createListingSync({ title: "2019 Ford F-150 Raptor", description: "Fox shocks, Baja mode, clean title.", price: 54000, category: "Trucks", condition: "Good", location: "Phoenix, AZ", year: 2019, make: "Ford", model: "F-150 Raptor", mileage: 38000, images: [], sellerId: u1.id, status: "active", featured: true, createdAt: new Date().toISOString() });

    this.createGroupSync({ name: "Desert Riders AZ", description: "Arizona's largest off-road community.", category: "Off-Road", memberCount: 2847, postCount: 412, ownerId: u1.id, private: false, createdAt: new Date().toISOString() });
    this.createGroupSync({ name: "Jet Ski Nation", description: "Everything water sports — racing, recreation, and marketplace.", category: "Jet Skis", memberCount: 1203, postCount: 89, ownerId: u3.id, private: false, createdAt: new Date().toISOString() });
    this.createGroupSync({ name: "Truck Life Collective", description: "Trucks, overlanding, towing — mods, builds, and advice.", category: "Trucks", memberCount: 5621, postCount: 1047, ownerId: u1.id, private: false, createdAt: new Date().toISOString() });
  }

  private createUserSync(user: any): User {
    const newUser = { id: this.userIdCounter++, ...user };
    this.users.set(newUser.id, newUser);
    return newUser;
  }
  private createListingSync(listing: any): Listing {
    const newListing = { id: this.listingIdCounter++, views: 0, saves: 0, ...listing };
    this.listings.set(newListing.id, newListing);
    return newListing;
  }
  private createGroupSync(group: any): Group {
    const newGroup = { id: this.groupIdCounter++, coverImage: null, ...group };
    this.groups.set(newGroup.id, newGroup);
    return newGroup;
  }

  async getUser(id: number) { return this.users.get(id); }
  async getUserByUsername(username: string) { return Array.from(this.users.values()).find(u => u.username === username); }
  async getUserByAuthId(authId: string) { return Array.from(this.users.values()).find(u => (u as any).authId === authId); }
  async createUser(user: InsertUser & { authId?: string; email?: string }) {
    const newUser: User = { id: this.userIdCounter++, rating: 0, reviewCount: 0, verified: false, responseTime: "Usually within a few hours", avatar: null, bio: null, location: null, ...user };
    this.users.set(newUser.id, newUser);
    return newUser;
  }
  async updateUser(id: number, data: Partial<User>) {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }
  async listUsers() { return Array.from(this.users.values()); }

  async getListing(id: number) { return this.listings.get(id); }
  async listListings(filters?: { category?: string; status?: string }) {
    let result = Array.from(this.listings.values());
    if (filters?.category) result = result.filter(l => l.category === filters.category);
    result = result.filter(l => l.status === (filters?.status || "active"));
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async createListing(listing: InsertListing) {
    const newListing: Listing = { id: this.listingIdCounter++, views: 0, saves: 0, year: null, make: null, model: null, mileage: null, images: [], status: "active", featured: false, ...listing, createdAt: new Date().toISOString() };
    this.listings.set(newListing.id, newListing);
    return newListing;
  }
  async updateListingViews(id: number) {
    const l = this.listings.get(id);
    if (l) this.listings.set(id, { ...l, views: (l.views || 0) + 1 });
  }
  async saveListing(id: number) {
    const l = this.listings.get(id);
    if (l) this.listings.set(id, { ...l, saves: (l.saves || 0) + 1 });
  }
  async updateListing(id: number, data: Partial<Listing>) {
    const l = this.listings.get(id);
    if (!l) return undefined;
    const updated = { ...l, ...data };
    this.listings.set(id, updated);
    return updated;
  }
  async deleteListing(id: number) { this.listings.delete(id); }

  async getGroup(id: number) { return this.groups.get(id); }
  async listGroups(category?: string) {
    let result = Array.from(this.groups.values());
    if (category) result = result.filter(g => g.category === category);
    return result.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  }
  async createGroup(group: InsertGroup) {
    const newGroup: Group = { id: this.groupIdCounter++, memberCount: 0, postCount: 0, coverImage: null, private: false, ...group, createdAt: new Date().toISOString() };
    this.groups.set(newGroup.id, newGroup);
    return newGroup;
  }

  async getPost(id: number) { return this.posts.get(id); }
  async listPostsByGroup(groupId: number) {
    return Array.from(this.posts.values()).filter(p => p.groupId === groupId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async createPost(post: InsertPost) {
    const newPost: Post = { id: this.postIdCounter++, likes: 0, commentCount: 0, images: [], ...post, createdAt: new Date().toISOString() };
    this.posts.set(newPost.id, newPost);
    return newPost;
  }

  async listReviewsForUser(userId: number) {
    return Array.from(this.reviews.values()).filter(r => r.revieweeId === userId);
  }
  async createReview(review: InsertReview) {
    const newReview: Review = { id: this.reviewIdCounter++, listingId: null, ...review, createdAt: new Date().toISOString() };
    this.reviews.set(newReview.id, newReview);
    return newReview;
  }

  // ── Groups social stubs for MemStorage ──
  private groupMembers: Map<string, { userId: number; groupId: number; role: string }> = new Map();
  private postLikes: Set<string> = new Set();

  async joinGroup(groupId: number, userId: number): Promise<void> {
    const key = `${groupId}-${userId}`;
    if (!this.groupMembers.has(key)) {
      this.groupMembers.set(key, { userId, groupId, role: 'member' });
      const g = this.groups.get(groupId);
      if (g) this.groups.set(groupId, { ...g, memberCount: (g.memberCount || 0) + 1 });
    }
  }
  async leaveGroup(groupId: number, userId: number): Promise<void> {
    const key = `${groupId}-${userId}`;
    if (this.groupMembers.has(key)) {
      this.groupMembers.delete(key);
      const g = this.groups.get(groupId);
      if (g) this.groups.set(groupId, { ...g, memberCount: Math.max(0, (g.memberCount || 1) - 1) });
    }
  }
  async isMember(groupId: number, userId: number): Promise<boolean> {
    return this.groupMembers.has(`${groupId}-${userId}`);
  }
  async likePost(postId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
    const key = `${postId}-${userId}`;
    const post = this.posts.get(postId);
    const currentLikes = post?.likes || 0;
    if (this.postLikes.has(key)) {
      this.postLikes.delete(key);
      const newLikes = Math.max(0, currentLikes - 1);
      if (post) this.posts.set(postId, { ...post, likes: newLikes });
      return { liked: false, likes: newLikes };
    } else {
      this.postLikes.add(key);
      const newLikes = currentLikes + 1;
      if (post) this.posts.set(postId, { ...post, likes: newLikes });
      return { liked: true, likes: newLikes };
    }
  }
  async updateGroup(id: number, data: Partial<Group>): Promise<Group | undefined> {
    const g = this.groups.get(id);
    if (!g) return undefined;
    const updated = { ...g, ...data };
    this.groups.set(id, updated);
    return updated;
  }

  // ── Messaging stubs for MemStorage ──
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private convIdCounter = 1;
  private msgIdCounter = 1;

  async getOrCreateConversation(userA: number, userB: number, listingId?: number | null): Promise<Conversation> {
    const p1 = Math.min(userA, userB);
    const p2 = Math.max(userA, userB);
    const existing = Array.from(this.conversations.values()).find(
      c => c.participant1Id === p1 && c.participant2Id === p2
    );
    if (existing) return existing;
    const conv: Conversation = {
      id: this.convIdCounter++, participant1Id: p1, participant2Id: p2,
      listingId: listingId || null, lastMessage: null,
      lastMessageAt: new Date().toISOString(), unreadCount1: 0, unreadCount2: 0,
      createdAt: new Date().toISOString(),
    };
    this.conversations.set(conv.id, conv);
    return conv;
  }
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  async listConversations(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(c => c.participant1Id === userId || c.participant2Id === userId)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }
  async listMessages(conversationId: number, _limit = 100): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  async sendMessage(conversationId: number, senderId: number, content: string): Promise<Message> {
    const msg: Message = {
      id: this.msgIdCounter++, conversationId, senderId, content,
      readAt: null, createdAt: new Date().toISOString(),
      sender: await this.getUser(senderId),
    };
    this.messages.set(msg.id, msg);
    const conv = this.conversations.get(conversationId);
    if (conv) this.conversations.set(conversationId, { ...conv, lastMessage: content, lastMessageAt: msg.createdAt });
    return msg;
  }
  async markMessagesRead(conversationId: number, userId: number): Promise<void> {
    const now = new Date().toISOString();
    for (const [id, msg] of this.messages) {
      if (msg.conversationId === conversationId && msg.senderId !== userId && !msg.readAt) {
        this.messages.set(id, { ...msg, readAt: now });
      }
    }
  }
}

// Export the right storage based on environment
export const storage: IStorage = isSupabaseConfigured() ? new SupabaseStorage() : new MemStorage();
