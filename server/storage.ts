import { supabaseAdmin, isSupabaseConfigured } from "./supabase";
import type {
  User, InsertUser,
  Listing, InsertListing,
  Group, InsertGroup,
  Post, InsertPost,
  Review, InsertReview,
} from "@shared/schema";

// ── Guide types (not in Drizzle schema — raw Supabase) ──
export interface GuidePart {
  name: string;
  link?: string;
  price?: number;
}

export interface GuideStep {
  title: string;
  description: string;
  imageUrls?: string[];
  tools?: string[];
  parts?: string[];
  estimatedTime?: string;
}

export interface Guide {
  id: number;
  title: string;
  description: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYearStart: string;
  vehicleYearEnd: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeEstimate: string;
  category?: string;
  tags: string[];
  tools: string[];
  parts: GuidePart[];
  steps: GuideStep[];
  coverImageId?: string;
  authorId: number;
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  // enriched
  author?: User;
  isLiked?: boolean;
}

export interface GuideComment {
  id: number;
  guideId: number;
  authorId: number;
  content: string;
  createdAt: string;
  author?: User;
}

export type InsertGuide = Omit<Guide, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt' | 'author' | 'isLiked'>;

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

  // User's joined groups
  listGroupsForUser(userId: number): Promise<Group[]>;

  // Group rules
  listGroupRules(groupId: number): Promise<any[]>;
  setGroupRules(groupId: number, rules: { title: string; body?: string }[]): Promise<void>;

  // Group setup
  completeGroupSetup(groupId: number, data: { avatar?: string; coverImage?: string; setupComplete?: boolean }): Promise<void>;

  // Private group join requests
  requestJoinGroup(groupId: number, userId: number, message?: string): Promise<void>;
  cancelJoinRequest(groupId: number, userId: number): Promise<void>;
  approveJoinRequest(groupId: number, userId: number, actorId: number): Promise<void>;
  denyJoinRequest(groupId: number, userId: number): Promise<void>;
  getJoinRequestStatus(groupId: number, userId: number): Promise<'none' | 'pending' | 'approved' | 'denied'>;
  listPendingJoinRequests(groupId: number): Promise<any[]>;

  // Notifications
  createNotification(n: {
    userId: number;
    type: string;
    title: string;
    body?: string;
    linkType?: string;
    linkId?: number;
    actorId?: number;
  }): Promise<void>;
  listNotifications(userId: number, limit?: number): Promise<any[]>;
  getUnreadCount(userId: number): Promise<number>;
  markNotificationRead(id: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  deleteNotification(id: number, userId: number): Promise<void>;

  // Global search
  searchAll(query: string): Promise<{
    listings: any[];
    groups: any[];
    guides: any[];
    users: any[];
    posts: any[];
  }>;
  searchListings(query: string, filters?: { category?: string; minPrice?: number; maxPrice?: number; condition?: string; location?: string; sort?: string }): Promise<any[]>;
  searchGroupPosts(groupId: number, query: string): Promise<any[]>;
  searchGroupMembers(groupId: number, query: string): Promise<any[]>;

  // Guides
  getGuide(id: number, requestingUserId?: number): Promise<Guide | undefined>;
  listGuides(filters?: { category?: string; difficulty?: string; search?: string; authorId?: number }): Promise<Guide[]>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  updateGuide(id: number, data: Partial<Guide>): Promise<Guide | undefined>;
  deleteGuide(id: number): Promise<void>;
  likeGuide(guideId: number, userId: number): Promise<{ liked: boolean; likes: number }>;
  incrementGuideViews(id: number): Promise<void>;
  listGuideComments(guideId: number): Promise<GuideComment[]>;
  createGuideComment(guideId: number, authorId: number, content: string): Promise<GuideComment>;
  deleteGuideComment(commentId: number): Promise<void>;
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
      guideId: row.guide_id ?? null,
    } as any;
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

  async createPost(post: InsertPost & { guideId?: number | null }): Promise<Post> {
    const { data, error } = await supabaseAdmin.from("posts").insert({
      group_id: post.groupId,
      author_id: post.authorId,
      content: post.content,
      images: post.images || [],
      guide_id: (post as any).guideId ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapPost(data);
  }

  async togglePostHelped(postId: number, userId: number): Promise<{ helped: boolean; count: number }> {
    const { data: existing } = await supabaseAdmin.from("post_helped").select("post_id").eq("post_id", postId).eq("user_id", userId).single();
    if (existing) {
      await supabaseAdmin.from("post_helped").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabaseAdmin.from("post_helped").insert({ post_id: postId, user_id: userId }).select().single().catch(() => null);
    }
    const { count } = await supabaseAdmin.from("post_helped").select("*", { count: "exact", head: true }).eq("post_id", postId);
    return { helped: !existing, count: count ?? 0 };
  }

  async getPostHelpedStatus(postId: number, userId: number): Promise<boolean> {
    const { data } = await supabaseAdmin.from("post_helped").select("post_id").eq("post_id", postId).eq("user_id", userId).single();
    return !!data;
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

  async listGroupsForUser(userId: number): Promise<Group[]> {
    const { data: memberships } = await supabaseAdmin
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    if (!memberships?.length) return [];
    const groupIds = memberships.map((m: any) => m.group_id);
    const { data } = await supabaseAdmin
      .from("groups")
      .select("*")
      .in("id", groupIds)
      .order("member_count", { ascending: false });
    return (data || []).map(this.mapGroup.bind(this));
  }

  async listGroupRules(groupId: number): Promise<any[]> {
    const { data } = await supabaseAdmin
      .from("group_rules")
      .select("*")
      .eq("group_id", groupId)
      .order("position", { ascending: true });
    return data || [];
  }

  async setGroupRules(groupId: number, rules: { title: string; body?: string }[]): Promise<void> {
    // Delete existing rules then insert new ones
    await supabaseAdmin.from("group_rules").delete().eq("group_id", groupId);
    if (!rules.length) return;
    await supabaseAdmin.from("group_rules").insert(
      rules.map((r, i) => ({
        group_id: groupId,
        position: i,
        title: r.title,
        body: r.body || null,
      }))
    );
  }

  async completeGroupSetup(groupId: number, data: { avatar?: string; coverImage?: string; setupComplete?: boolean }): Promise<void> {
    const updates: any = {};
    if (data.avatar !== undefined) updates.avatar = data.avatar;
    if (data.coverImage !== undefined) updates.cover_image = data.coverImage;
    if (data.setupComplete !== undefined) updates.setup_complete = data.setupComplete;
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("groups").update(updates).eq("id", groupId);
    }
  }

  // ──────────────────────────────────────────────────────────
  // PRIVATE GROUP JOIN REQUESTS
  // ──────────────────────────────────────────────────────────

  async requestJoinGroup(groupId: number, userId: number, message?: string): Promise<void> {
    await supabaseAdmin.from("group_join_requests").upsert({
      group_id: groupId, user_id: userId, status: 'pending',
      message: message || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'group_id,user_id' }).select().single().catch(() => null);
  }

  async cancelJoinRequest(groupId: number, userId: number): Promise<void> {
    await supabaseAdmin.from("group_join_requests").delete().eq("group_id", groupId).eq("user_id", userId);
  }

  async approveJoinRequest(groupId: number, userId: number, actorId: number): Promise<void> {
    await supabaseAdmin.from("group_join_requests").update({ status: 'approved', updated_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", userId);
    await this.joinGroup(groupId, userId);
    // Delete the request after approved join
    await supabaseAdmin.from("group_join_requests").delete().eq("group_id", groupId).eq("user_id", userId);
  }

  async denyJoinRequest(groupId: number, userId: number): Promise<void> {
    await supabaseAdmin.from("group_join_requests").update({ status: 'denied', updated_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", userId);
  }

  async getJoinRequestStatus(groupId: number, userId: number): Promise<'none' | 'pending' | 'approved' | 'denied'> {
    const { data } = await supabaseAdmin.from("group_join_requests").select("status").eq("group_id", groupId).eq("user_id", userId).single();
    return (data?.status as any) || 'none';
  }

  async listPendingJoinRequests(groupId: number): Promise<any[]> {
    const { data } = await supabaseAdmin.from("group_join_requests").select("*").eq("group_id", groupId).eq("status", 'pending').order("created_at", { ascending: true });
    const rows = data || [];
    return Promise.all(rows.map(async (row: any) => ({
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      status: row.status,
      message: row.message,
      createdAt: row.created_at,
      user: await this.getUser(row.user_id),
    })));
  }

  // ──────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────────────────

  private mapNotification(row: any, actor?: User): any {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      linkType: row.link_type,
      linkId: row.link_id,
      actorId: row.actor_id,
      read: row.read,
      createdAt: row.created_at,
      actor,
    };
  }

  async createNotification(n: { userId: number; type: string; title: string; body?: string; linkType?: string; linkId?: number; actorId?: number }): Promise<void> {
    // Don’t notify users about their own actions
    if (n.actorId && n.actorId === n.userId) return;
    await supabaseAdmin.from("notifications").insert({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body || null,
      link_type: n.linkType || null,
      link_id: n.linkId || null,
      actor_id: n.actorId || null,
    }).select().single().catch(() => null);
  }

  async listNotifications(userId: number, limit = 30): Promise<any[]> {
    const { data } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = data || [];
    return Promise.all(rows.map(async (row: any) => {
      const actor = row.actor_id ? await this.getUser(row.actor_id) : undefined;
      return this.mapNotification(row, actor);
    }));
  }

  async getUnreadCount(userId: number): Promise<number> {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    return count ?? 0;
  }

  async markNotificationRead(id: number, userId: number): Promise<void> {
    await supabaseAdmin.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await supabaseAdmin.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  }

  async deleteNotification(id: number, userId: number): Promise<void> {
    await supabaseAdmin.from("notifications").delete().eq("id", id).eq("user_id", userId);
  }

  // ──────────────────────────────────────────────────────────
  // SEARCH
  // ──────────────────────────────────────────────────────────

  async searchAll(query: string) {
    const q = `%${query}%`;
    const [listings, groups, guides, users, posts] = await Promise.all([
      supabaseAdmin.from("listings").select("id,title,price,category,images,condition,location,year,make,model").or(`title.ilike.${q},description.ilike.${q},make.ilike.${q},model.ilike.${q}`).eq("status", "active").limit(6),
      supabaseAdmin.from("groups").select("id,name,description,category,cover_image,member_count").or(`name.ilike.${q},description.ilike.${q}`).limit(6),
      supabaseAdmin.from("guides").select("id,title,description,difficulty,time_estimate,vehicle_make,vehicle_model,vehicle_year_start,author_id").or(`title.ilike.${q},description.ilike.${q},vehicle_make.ilike.${q},vehicle_model.ilike.${q}`).limit(6),
      supabaseAdmin.from("users").select("id,username,display_name,avatar,location,rating,verified").or(`username.ilike.${q},display_name.ilike.${q}`).limit(6),
      supabaseAdmin.from("posts").select("id,content,group_id,author_id,created_at").ilike("content", `%${query}%`).limit(6),
    ]);
    // Enrich posts with group + author
    const enrichedPosts = await Promise.all((posts.data || []).map(async (p: any) => ({
      ...p,
      group: (await supabaseAdmin.from("groups").select("id,name").eq("id", p.group_id).single()).data,
      author: (await supabaseAdmin.from("users").select("id,username,display_name,avatar").eq("id", p.author_id).single()).data,
    })));
    return {
      listings: listings.data || [],
      groups: groups.data || [],
      guides: guides.data || [],
      users: users.data || [],
      posts: enrichedPosts,
    };
  }

  async searchListings(query: string, filters?: { category?: string; minPrice?: number; maxPrice?: number; condition?: string; location?: string; sort?: string }) {
    const q = `%${query}%`;
    let qb = supabaseAdmin.from("listings").select("*").eq("status", "active");
    if (query) qb = qb.or(`title.ilike.${q},description.ilike.${q},make.ilike.${q},model.ilike.${q},location.ilike.${q}`);
    if (filters?.category) qb = qb.eq("category", filters.category);
    if (filters?.condition) qb = qb.eq("condition", filters.condition);
    if (filters?.location) qb = qb.ilike("location", `%${filters.location}%`);
    if (filters?.minPrice !== undefined) qb = qb.gte("price", filters.minPrice);
    if (filters?.maxPrice !== undefined) qb = qb.lte("price", filters.maxPrice);
    if (filters?.sort === "price_asc") qb = qb.order("price", { ascending: true });
    else if (filters?.sort === "price_desc") qb = qb.order("price", { ascending: false });
    else if (filters?.sort === "newest") qb = qb.order("created_at", { ascending: false });
    else qb = qb.order("featured", { ascending: false }).order("created_at", { ascending: false });
    const { data } = await qb.limit(100);
    return (data || []).map(this.mapListing.bind(this));
  }

  async searchGroupPosts(groupId: number, query: string) {
    const { data } = await supabaseAdmin.from("posts").select("*").eq("group_id", groupId).ilike("content", `%${query}%`).order("created_at", { ascending: false }).limit(50);
    const rows = data || [];
    return Promise.all(rows.map(async (p: any) => ({
      ...this.mapPost(p),
      author: await this.getUser(p.author_id),
    })));
  }

  async searchGroupMembers(groupId: number, query: string) {
    const q = `%${query}%`;
    const { data: members } = await supabaseAdmin.from("group_members").select("user_id,role").eq("group_id", groupId);
    if (!members?.length) return [];
    const userIds = members.map((m: any) => m.user_id);
    const { data: users } = await supabaseAdmin.from("users").select("id,username,display_name,avatar,rating,verified,location").in("id", userIds).or(`username.ilike.${q},display_name.ilike.${q}`);
    return (users || []).map((u: any) => ({
      ...this.mapUser(u),
      role: members.find((m: any) => m.user_id === u.id)?.role,
    }));
  }

  // ──────────────────────────────────────────────────────────
  // GUIDES
  // ──────────────────────────────────────────────────────────

  private mapGuide(row: any, author?: User, isLiked?: boolean): Guide {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      vehicleMake: row.vehicle_make,
      vehicleModel: row.vehicle_model,
      vehicleYearStart: row.vehicle_year_start,
      vehicleYearEnd: row.vehicle_year_end,
      difficulty: row.difficulty,
      timeEstimate: row.time_estimate,
      category: row.category,
      tags: row.tags || [],
      tools: row.tools || [],
      parts: row.parts || [],
      steps: row.steps || [],
      coverImageId: row.cover_image_id,
      authorId: row.author_id,
      views: row.views || 0,
      likes: row.likes || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author,
      isLiked,
    };
  }

  private mapGuideComment(row: any, author?: User): GuideComment {
    return {
      id: row.id,
      guideId: row.guide_id,
      authorId: row.author_id,
      content: row.content,
      createdAt: row.created_at,
      author,
    };
  }

  async getGuide(id: number, requestingUserId?: number): Promise<Guide | undefined> {
    const { data } = await supabaseAdmin.from("guides").select("*").eq("id", id).single();
    if (!data) return undefined;
    const author = await this.getUser(data.author_id);
    let isLiked = false;
    if (requestingUserId) {
      const { data: like } = await supabaseAdmin.from("guide_likes").select("guide_id").eq("guide_id", id).eq("user_id", requestingUserId).single();
      isLiked = !!like;
    }
    return this.mapGuide(data, author, isLiked);
  }

  async listGuides(filters?: { category?: string; difficulty?: string; search?: string; authorId?: number }): Promise<Guide[]> {
    let query = supabaseAdmin.from("guides").select("*").order("created_at", { ascending: false });
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.difficulty) query = query.eq("difficulty", filters.difficulty);
    if (filters?.authorId) query = query.eq("author_id", filters.authorId);
    if (filters?.search) query = query.ilike("title", `%${filters.search}%`);
    const { data } = await query.limit(100);
    const rows = data || [];
    return Promise.all(rows.map(async (row: any) => {
      const author = await this.getUser(row.author_id);
      return this.mapGuide(row, author);
    }));
  }

  async createGuide(guide: InsertGuide): Promise<Guide> {
    const { data, error } = await supabaseAdmin.from("guides").insert({
      title: guide.title,
      description: guide.description,
      vehicle_make: guide.vehicleMake,
      vehicle_model: guide.vehicleModel,
      vehicle_year_start: guide.vehicleYearStart,
      vehicle_year_end: guide.vehicleYearEnd,
      difficulty: guide.difficulty,
      time_estimate: guide.timeEstimate,
      category: guide.category,
      tags: guide.tags || [],
      tools: guide.tools || [],
      parts: guide.parts || [],
      steps: guide.steps || [],
      cover_image_id: guide.coverImageId,
      author_id: guide.authorId,
    }).select().single();
    if (error) throw new Error(error.message);
    const author = await this.getUser(data.author_id);
    return this.mapGuide(data, author, false);
  }

  async updateGuide(id: number, data: Partial<Guide>): Promise<Guide | undefined> {
    const updates: any = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.vehicleMake !== undefined) updates.vehicle_make = data.vehicleMake;
    if (data.vehicleModel !== undefined) updates.vehicle_model = data.vehicleModel;
    if (data.vehicleYearStart !== undefined) updates.vehicle_year_start = data.vehicleYearStart;
    if (data.vehicleYearEnd !== undefined) updates.vehicle_year_end = data.vehicleYearEnd;
    if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
    if (data.timeEstimate !== undefined) updates.time_estimate = data.timeEstimate;
    if (data.category !== undefined) updates.category = data.category;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.tools !== undefined) updates.tools = data.tools;
    if (data.parts !== undefined) updates.parts = data.parts;
    if (data.steps !== undefined) updates.steps = data.steps;
    if (data.coverImageId !== undefined) updates.cover_image_id = data.coverImageId;
    const { data: row } = await supabaseAdmin.from("guides").update(updates).eq("id", id).select().single();
    if (!row) return undefined;
    const author = await this.getUser(row.author_id);
    return this.mapGuide(row, author);
  }

  async deleteGuide(id: number): Promise<void> {
    await supabaseAdmin.from("guides").delete().eq("id", id);
  }

  async likeGuide(guideId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
    const { data: existing } = await supabaseAdmin.from("guide_likes").select("guide_id").eq("guide_id", guideId).eq("user_id", userId).single();
    const { data: guide } = await supabaseAdmin.from("guides").select("likes").eq("id", guideId).single();
    const currentLikes = guide?.likes || 0;
    if (existing) {
      await supabaseAdmin.from("guide_likes").delete().eq("guide_id", guideId).eq("user_id", userId);
      const newLikes = Math.max(0, currentLikes - 1);
      await supabaseAdmin.from("guides").update({ likes: newLikes }).eq("id", guideId);
      return { liked: false, likes: newLikes };
    } else {
      await supabaseAdmin.from("guide_likes").insert({ guide_id: guideId, user_id: userId }).select().single().catch(() => null);
      const newLikes = currentLikes + 1;
      await supabaseAdmin.from("guides").update({ likes: newLikes }).eq("id", guideId);
      return { liked: true, likes: newLikes };
    }
  }

  async incrementGuideViews(id: number): Promise<void> {
    const { data } = await supabaseAdmin.from("guides").select("views").eq("id", id).single();
    if (data) await supabaseAdmin.from("guides").update({ views: (data.views || 0) + 1 }).eq("id", id);
  }

  async listGuideComments(guideId: number): Promise<GuideComment[]> {
    const { data } = await supabaseAdmin.from("guide_comments").select("*").eq("guide_id", guideId).order("created_at", { ascending: true });
    const rows = data || [];
    return Promise.all(rows.map(async (row: any) => {
      const author = await this.getUser(row.author_id);
      return this.mapGuideComment(row, author);
    }));
  }

  async createGuideComment(guideId: number, authorId: number, content: string): Promise<GuideComment> {
    const { data, error } = await supabaseAdmin.from("guide_comments").insert({
      guide_id: guideId,
      author_id: authorId,
      content,
    }).select().single();
    if (error) throw new Error(error.message);
    const author = await this.getUser(authorId);
    return this.mapGuideComment(data, author);
  }

  async deleteGuideComment(commentId: number): Promise<void> {
    await supabaseAdmin.from("guide_comments").delete().eq("id", commentId);
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

  async listGroupsForUser(userId: number): Promise<Group[]> {
    const memberGroupIds = Array.from(this.groupMembers.values())
      .filter(m => m.userId === userId)
      .map(m => m.groupId);
    return Array.from(this.groups.values()).filter(g => memberGroupIds.includes(g.id));
  }

  private _groupRules: Map<number, any[]> = new Map();
  async listGroupRules(groupId: number): Promise<any[]> {
    return this._groupRules.get(groupId) || [];
  }
  async setGroupRules(groupId: number, rules: { title: string; body?: string }[]): Promise<void> {
    this._groupRules.set(groupId, rules.map((r, i) => ({ id: i + 1, groupId, position: i, ...r })));
  }
  async completeGroupSetup(groupId: number, data: any): Promise<void> {
    const g = this.groups.get(groupId);
    if (g) this.groups.set(groupId, { ...g, ...(data.avatar && { avatar: data.avatar }), ...(data.coverImage && { coverImage: data.coverImage }) });
  }

  // ── Private group join request stubs for MemStorage ──
  private _joinRequests: Map<string, any> = new Map();
  async requestJoinGroup(groupId: number, userId: number, message?: string): Promise<void> {
    this._joinRequests.set(`${groupId}-${userId}`, { groupId, userId, status: 'pending', message, createdAt: new Date().toISOString() });
  }
  async cancelJoinRequest(groupId: number, userId: number): Promise<void> {
    this._joinRequests.delete(`${groupId}-${userId}`);
  }
  async approveJoinRequest(groupId: number, userId: number, _actorId: number): Promise<void> {
    this._joinRequests.delete(`${groupId}-${userId}`);
    await this.joinGroup(groupId, userId);
  }
  async denyJoinRequest(groupId: number, userId: number): Promise<void> {
    const r = this._joinRequests.get(`${groupId}-${userId}`);
    if (r) this._joinRequests.set(`${groupId}-${userId}`, { ...r, status: 'denied' });
  }
  async getJoinRequestStatus(groupId: number, userId: number): Promise<'none' | 'pending' | 'approved' | 'denied'> {
    return this._joinRequests.get(`${groupId}-${userId}`)?.status || 'none';
  }
  async listPendingJoinRequests(groupId: number): Promise<any[]> {
    return Array.from(this._joinRequests.values()).filter(r => r.groupId === groupId && r.status === 'pending');
  }

  // ── Notification stubs for MemStorage ──
  private _notifications: Map<number, any> = new Map();
  private _notifIdCounter = 1;
  async createNotification(n: any): Promise<void> {
    if (n.actorId && n.actorId === n.userId) return;
    const notif = { id: this._notifIdCounter++, ...n, read: false, createdAt: new Date().toISOString() };
    this._notifications.set(notif.id, notif);
  }
  async listNotifications(userId: number, limit = 30): Promise<any[]> {
    return Array.from(this._notifications.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  async getUnreadCount(userId: number): Promise<number> {
    return Array.from(this._notifications.values()).filter(n => n.userId === userId && !n.read).length;
  }
  async markNotificationRead(id: number, userId: number): Promise<void> {
    const n = this._notifications.get(id);
    if (n && n.userId === userId) this._notifications.set(id, { ...n, read: true });
  }
  async markAllNotificationsRead(userId: number): Promise<void> {
    for (const [id, n] of this._notifications) {
      if (n.userId === userId) this._notifications.set(id, { ...n, read: true });
    }
  }
  async deleteNotification(id: number, userId: number): Promise<void> {
    const n = this._notifications.get(id);
    if (n?.userId === userId) this._notifications.delete(id);
  }

  // ── Search stubs for MemStorage ──
  async searchAll(query: string) {
    const q = query.toLowerCase();
    const listings = Array.from(this.listings.values()).filter(l =>
      l.status === "active" && (l.title.toLowerCase().includes(q) || (l.make || "").toLowerCase().includes(q) || (l.model || "").toLowerCase().includes(q))
    ).slice(0, 6);
    const groups = Array.from(this.groups.values()).filter(g =>
      g.name.toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q)
    ).slice(0, 6);
    const users = Array.from(this.users.values()).filter(u =>
      u.username.toLowerCase().includes(q) || (u.displayName || "").toLowerCase().includes(q)
    ).slice(0, 6);
    return { listings, groups, guides: [], users, posts: [] };
  }
  async searchListings(query: string, filters?: any) {
    const q = query.toLowerCase();
    let result = Array.from(this.listings.values()).filter(l => l.status === "active");
    if (query) result = result.filter(l => l.title.toLowerCase().includes(q) || (l.make || "").toLowerCase().includes(q) || (l.model || "").toLowerCase().includes(q));
    if (filters?.category) result = result.filter(l => l.category === filters.category);
    if (filters?.condition) result = result.filter(l => l.condition === filters.condition);
    if (filters?.minPrice !== undefined) result = result.filter(l => l.price >= filters.minPrice);
    if (filters?.maxPrice !== undefined) result = result.filter(l => l.price <= filters.maxPrice);
    if (filters?.sort === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (filters?.sort === "price_desc") result.sort((a, b) => b.price - a.price);
    else result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }
  async searchGroupPosts(groupId: number, query: string) {
    const q = query.toLowerCase();
    return Array.from(this.posts.values()).filter(p => p.groupId === groupId && p.content.toLowerCase().includes(q));
  }
  async searchGroupMembers(groupId: number, query: string) {
    const q = query.toLowerCase();
    return Array.from(this.users.values()).filter(u =>
      u.username.toLowerCase().includes(q) || (u.displayName || "").toLowerCase().includes(q)
    ).slice(0, 20);
  }

  // ── Guide stubs for MemStorage ──
  private guides: Map<number, Guide> = new Map();
  private guideLikes: Set<string> = new Set();
  private guideComments: Map<number, GuideComment> = new Map();
  private guideIdCounter = 1;
  private guideCommentIdCounter = 1;

  async getGuide(id: number, requestingUserId?: number): Promise<Guide | undefined> {
    const g = this.guides.get(id);
    if (!g) return undefined;
    const isLiked = requestingUserId ? this.guideLikes.has(`${id}-${requestingUserId}`) : false;
    return { ...g, isLiked };
  }
  async listGuides(filters?: { category?: string; difficulty?: string; search?: string; authorId?: number }): Promise<Guide[]> {
    let result = Array.from(this.guides.values());
    if (filters?.category) result = result.filter(g => g.category === filters.category);
    if (filters?.difficulty) result = result.filter(g => g.difficulty === filters.difficulty);
    if (filters?.authorId) result = result.filter(g => g.authorId === filters.authorId);
    if (filters?.search) result = result.filter(g => g.title.toLowerCase().includes(filters.search!.toLowerCase()));
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async createGuide(guide: InsertGuide): Promise<Guide> {
    const newGuide: Guide = { id: this.guideIdCounter++, views: 0, likes: 0, ...guide, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.guides.set(newGuide.id, newGuide);
    return newGuide;
  }
  async updateGuide(id: number, data: Partial<Guide>): Promise<Guide | undefined> {
    const g = this.guides.get(id);
    if (!g) return undefined;
    const updated = { ...g, ...data, updatedAt: new Date().toISOString() };
    this.guides.set(id, updated);
    return updated;
  }
  async deleteGuide(id: number): Promise<void> { this.guides.delete(id); }
  async likeGuide(guideId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
    const key = `${guideId}-${userId}`;
    const guide = this.guides.get(guideId);
    const currentLikes = guide?.likes || 0;
    if (this.guideLikes.has(key)) {
      this.guideLikes.delete(key);
      const newLikes = Math.max(0, currentLikes - 1);
      if (guide) this.guides.set(guideId, { ...guide, likes: newLikes });
      return { liked: false, likes: newLikes };
    } else {
      this.guideLikes.add(key);
      const newLikes = currentLikes + 1;
      if (guide) this.guides.set(guideId, { ...guide, likes: newLikes });
      return { liked: true, likes: newLikes };
    }
  }
  async incrementGuideViews(id: number): Promise<void> {
    const g = this.guides.get(id);
    if (g) this.guides.set(id, { ...g, views: (g.views || 0) + 1 });
  }
  async listGuideComments(guideId: number): Promise<GuideComment[]> {
    return Array.from(this.guideComments.values()).filter(c => c.guideId === guideId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  async createGuideComment(guideId: number, authorId: number, content: string): Promise<GuideComment> {
    const comment: GuideComment = { id: this.guideCommentIdCounter++, guideId, authorId, content, createdAt: new Date().toISOString() };
    this.guideComments.set(comment.id, comment);
    return comment;
  }
  async deleteGuideComment(commentId: number): Promise<void> { this.guideComments.delete(commentId); }

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
