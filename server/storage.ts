import type { User, InsertUser, Listing, InsertListing, Group, InsertGroup, Post, InsertPost, Review, InsertReview } from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  createUser(user: InsertUser): User;
  listUsers(): User[];

  // Listings
  getListing(id: number): Listing | undefined;
  listListings(filters?: { category?: string; status?: string }): Listing[];
  createListing(listing: InsertListing): Listing;
  updateListingViews(id: number): void;
  saveListing(id: number): void;

  // Groups
  getGroup(id: number): Group | undefined;
  listGroups(category?: string): Group[];
  createGroup(group: InsertGroup): Group;

  // Posts
  getPost(id: number): Post | undefined;
  listPostsByGroup(groupId: number): Post[];
  createPost(post: InsertPost): Post;

  // Reviews
  listReviewsForUser(userId: number): Review[];
  createReview(review: InsertReview): Review;
}

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
    // Seed users
    const u1 = this.createUser({ username: "throttlejockey88", displayName: "Jake Morrison", avatar: "https://i.pravatar.cc/150?img=11", bio: "Truck and Jeep enthusiast. Buy and sell clean builds only.", location: "Austin, TX", memberSince: "Jan 2022", rating: 4.9, reviewCount: 47, verified: true, responseTime: "Within an hour" });
    const u2 = this.createUser({ username: "dirtqueen_lisa", displayName: "Lisa Tran", avatar: "https://i.pravatar.cc/150?img=47", bio: "ATV and off-road racer. Always down to trade.", location: "Phoenix, AZ", memberSince: "Mar 2021", rating: 4.7, reviewCount: 32, verified: true, responseTime: "Usually within a few hours" });
    const u3 = this.createUser({ username: "waveripper99", displayName: "Marcus Bell", avatar: "https://i.pravatar.cc/150?img=15", bio: "Jet ski obsessed. Summer is my season.", location: "Tampa, FL", memberSince: "Jun 2023", rating: 4.8, reviewCount: 19, verified: false, responseTime: "Within a day" });
    const u4 = this.createUser({ username: "classicironmike", displayName: "Mike Deluca", avatar: "https://i.pravatar.cc/150?img=53", bio: "Classic car restorer. Patience and detail.", location: "Nashville, TN", memberSince: "Feb 2020", rating: 5.0, reviewCount: 88, verified: true, responseTime: "Within an hour" });
    const u5 = this.createUser({ username: "powersports_pedro", displayName: "Pedro Vasquez", avatar: "https://i.pravatar.cc/150?img=60", bio: "Everything with an engine. Let's talk.", location: "San Diego, CA", memberSince: "Aug 2022", rating: 4.6, reviewCount: 25, verified: false, responseTime: "Usually within a few hours" });

    // Seed listings
    // Using specific Unsplash photo IDs by category
    // Trucks
    const truckImg = "https://images.unsplash.com/photo-1571112438720-4b59f1f3a9ad?w=800&q=80";
    // ATVs / off-road
    const atvImg = "https://images.unsplash.com/photo-1610647752706-3bb12232b3ab?w=800&q=80";
    // Jet Ski / watercraft
    const jetSkiImg = "https://images.unsplash.com/photo-1520962880247-cfaf541c8724?w=800&q=80";
    // Cars / muscle
    const carImg = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80";
    const mustangImg = "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80";

    this.createListing({ title: "2022 Ford F-250 Super Duty — Lifted 4x4", description: "Clean title, full service history, 6-inch BDS lift, 37-inch Falken tires, Method wheels, ARB front bumper, light bar. Runs and drives perfect. No lowballers.", price: 58900, category: "Trucks", condition: "Excellent", location: "Austin, TX", year: 2022, make: "Ford", model: "F-250 Super Duty", mileage: 34000, images: [truckImg], sellerId: u1.id, status: "active", createdAt: "2 hours ago", featured: true });
    this.createListing({ title: "2021 Yamaha YFZ450R — Race Ready", description: "Full Pro Circuit exhaust, Boyesen clutch cover, Excel rims, fresh top end. Won 3 races last season. Ready to shred.", price: 8400, category: "ATVs", condition: "Good", location: "Phoenix, AZ", year: 2021, make: "Yamaha", model: "YFZ450R", mileage: 820, images: [atvImg], sellerId: u2.id, status: "active", createdAt: "5 hours ago", featured: true });
    this.createListing({ title: "2023 Sea-Doo RXP-X 300 — Low Hours", description: "Only 22 hours on hull. Watercraft cover, 4-point trailer hitch, RIVA catch kit. Fastest ski I've owned. Must sell, moving.", price: 16500, category: "Jet Skis", condition: "Like New", location: "Tampa, FL", year: 2023, make: "Sea-Doo", model: "RXP-X 300", mileage: 22, images: [jetSkiImg], sellerId: u3.id, status: "active", createdAt: "1 day ago", featured: true });
    this.createListing({ title: "1969 Ford Mustang Fastback — Resto-Mod", description: "Coyote 5.0 swap, Tremec T56 6-speed, Wilwood brakes, custom wiring. Drives like a dream, looks like original. Show quality.", price: 89000, category: "Cars", condition: "Excellent", location: "Nashville, TN", year: 1969, make: "Ford", model: "Mustang Fastback", mileage: 0, images: [mustangImg], sellerId: u4.id, status: "active", createdAt: "3 days ago", featured: true });
    this.createListing({ title: "2020 Can-Am Maverick X3 Turbo RR", description: "Stock with only 1,100 miles. Full cage, harnesses, beadlock wheels. Ready for Glamis or the trail. Priced to sell.", price: 29500, category: "ATVs", condition: "Excellent", location: "San Diego, CA", year: 2020, make: "Can-Am", model: "Maverick X3 Turbo RR", mileage: 1100, images: [atvImg], sellerId: u5.id, status: "active", createdAt: "4 days ago", featured: false });
    this.createListing({ title: "2019 Kawasaki Ultra 310R Jet Ski", description: "Supercharged beast. 310hp, 3-seater, recent service, Riva stage 2 intake. Comes with custom trailer. Low hours.", price: 12800, category: "Jet Skis", condition: "Good", location: "Tampa, FL", year: 2019, make: "Kawasaki", model: "Ultra 310R", mileage: 88, images: [jetSkiImg], sellerId: u3.id, status: "active", createdAt: "5 days ago", featured: false });
    this.createListing({ title: "2021 Dodge Ram TRX — Levinsohn Edition", description: "702hp supercharged from the factory. Levinsohn fox shocks upgrade, Morimoto headlights, bed liner. Mint condition.", price: 94000, category: "Trucks", condition: "Like New", location: "Austin, TX", year: 2021, make: "Dodge", model: "Ram 1500 TRX", mileage: 11200, images: [truckImg], sellerId: u1.id, status: "active", createdAt: "1 week ago", featured: false });
    this.createListing({ title: "2018 Honda Talon 1000X-4", description: "4-seater, full cage, stereo, snorkel kit. Family fun or trail shredder. Tons of fun, reason for selling: upgrading.", price: 18500, category: "ATVs", condition: "Good", location: "Phoenix, AZ", year: 2018, make: "Honda", model: "Talon 1000X-4", mileage: 2300, images: [atvImg], sellerId: u2.id, status: "active", createdAt: "1 week ago", featured: false });

    // Seed groups
    const g1 = this.createGroup({ name: "Texas Truck Builds", description: "The largest Texas-based truck enthusiast community. Share builds, mods, meet-ups, and buy/sell parts.", category: "Trucks", coverImage: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=80", memberCount: 14200, postCount: 3800, ownerId: u1.id, private: false, createdAt: "2020-01-15" });
    const g2 = this.createGroup({ name: "ATV & SxS Nation", description: "Dedicated to all-terrain vehicles and side-by-sides. Trail reviews, race schedules, builds, and classifieds.", category: "ATVs", coverImage: "https://images.unsplash.com/photo-1558980664-769d59546b3d?w=1200&q=80", memberCount: 9800, postCount: 2200, ownerId: u2.id, private: false, createdAt: "2021-03-20" });
    const g3 = this.createGroup({ name: "Jet Ski Junkies", description: "PWC enthusiasts unite. From Sea-Doo to Yamaha to Kawasaki — races, trips, mods, and sales.", category: "Jet Skis", coverImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80", memberCount: 6300, postCount: 1100, ownerId: u3.id, private: false, createdAt: "2022-06-01" });
    const g4 = this.createGroup({ name: "Classic Iron Garage", description: "For muscle car and vintage American iron restorers. Build threads, sourcing help, and show schedules.", category: "Cars", coverImage: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80", memberCount: 22100, postCount: 8700, ownerId: u4.id, private: false, createdAt: "2019-11-10" });
    const g5 = this.createGroup({ name: "Powersports Buy/Sell/Trade", description: "The general marketplace group. All powersports welcome — cars, trucks, ATVs, sleds, boats, jet skis.", category: "General", coverImage: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1200&q=80", memberCount: 31500, postCount: 12400, ownerId: u5.id, private: false, createdAt: "2019-05-01" });

    // Seed posts
    this.createPost({ groupId: g1.id, authorId: u1.id, content: "Just finished the bumper-to-bumper build on my F-250. ARB bullbar, Rigid Industries light bar, and new 37s. Hit the trails this weekend in Moab and it was flawless. Full build thread coming soon.", images: ["https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80"], likes: 214, commentCount: 38, createdAt: "3 hours ago" });
    this.createPost({ groupId: g2.id, authorId: u2.id, content: "Race report from the Havasu ATV race: YFZ450R took 2nd in the open class. Pro Circuit exhaust made a huge difference in the midrange. Anyone else running that setup?", images: [], likes: 87, commentCount: 21, createdAt: "1 day ago" });
    this.createPost({ groupId: g3.id, authorId: u3.id, content: "Weekend at Clearwater Beach was unreal. RXP-X 300 hits 70mph easy, no complaints. Tried the new RIVA tune and gained another 8mph top speed. 🔥", images: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80"], likes: 145, commentCount: 29, createdAt: "2 days ago" });
    this.createPost({ groupId: g4.id, authorId: u4.id, content: "Finally fired up the '69 Fastback with the Coyote swap. 12 months of wrenching, and she lit right up. The sound through the Flowmaster headers is everything. Video in the comments.", images: ["https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80"], likes: 512, commentCount: 94, createdAt: "4 days ago" });

    // Seed reviews
    this.createReview({ reviewerId: u2.id, revieweeId: u1.id, listingId: 1, rating: 5, comment: "Jake was awesome to deal with. Truck was exactly as described. Quick responses and smooth transaction. Would buy from again.", type: "seller", createdAt: "1 month ago" });
    this.createReview({ reviewerId: u3.id, revieweeId: u4.id, listingId: 4, rating: 5, comment: "Mike is the real deal. The Mustang is a show stopper. Super patient answering all my questions. 10/10 seller.", type: "seller", createdAt: "2 months ago" });
    this.createReview({ reviewerId: u1.id, revieweeId: u2.id, listingId: 2, rating: 4, comment: "Lisa was great. ATV was in solid shape. Took a bit longer to respond but worth the wait. Honest seller.", type: "seller", createdAt: "3 months ago" });
    this.createReview({ reviewerId: u4.id, revieweeId: u1.id, listingId: 1, rating: 5, comment: "Drove from Nashville to Austin for this truck and it was 100% worth it. Jake had every record. Top tier.", type: "seller", createdAt: "6 months ago" });
    this.createReview({ reviewerId: u5.id, revieweeId: u3.id, listingId: 3, rating: 5, comment: "Marcus was super responsive and the ski was exactly as described. Deal went down fast and easy.", type: "seller", createdAt: "2 months ago" });
  }

  getUser(id: number) { return this.users.get(id); }
  getUserByUsername(username: string) { return Array.from(this.users.values()).find(u => u.username === username); }
  createUser(data: InsertUser): User {
    const user: User = { id: this.userIdCounter++, ...data } as User;
    this.users.set(user.id, user);
    return user;
  }
  listUsers() { return Array.from(this.users.values()); }

  getListing(id: number) { return this.listings.get(id); }
  listListings(filters?: { category?: string; status?: string }) {
    let items = Array.from(this.listings.values());
    if (filters?.category && filters.category !== "All") items = items.filter(l => l.category === filters.category);
    if (filters?.status) items = items.filter(l => l.status === filters.status);
    return items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
  createListing(data: InsertListing): Listing {
    const listing: Listing = { id: this.listingIdCounter++, views: 0, saves: 0, ...data } as Listing;
    this.listings.set(listing.id, listing);
    return listing;
  }
  updateListingViews(id: number) {
    const l = this.listings.get(id);
    if (l) this.listings.set(id, { ...l, views: (l.views || 0) + 1 });
  }
  saveListing(id: number) {
    const l = this.listings.get(id);
    if (l) this.listings.set(id, { ...l, saves: (l.saves || 0) + 1 });
  }

  getGroup(id: number) { return this.groups.get(id); }
  listGroups(category?: string) {
    let items = Array.from(this.groups.values());
    if (category && category !== "All") items = items.filter(g => g.category === category);
    return items.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  }
  createGroup(data: InsertGroup): Group {
    const group: Group = { id: this.groupIdCounter++, memberCount: data.memberCount || 0, postCount: data.postCount || 0, ...data } as Group;
    this.groups.set(group.id, group);
    return group;
  }

  getPost(id: number) { return this.posts.get(id); }
  listPostsByGroup(groupId: number) {
    return Array.from(this.posts.values()).filter(p => p.groupId === groupId);
  }
  createPost(data: InsertPost): Post {
    const post: Post = { id: this.postIdCounter++, likes: data.likes || 0, commentCount: data.commentCount || 0, ...data } as Post;
    this.posts.set(post.id, post);
    return post;
  }

  listReviewsForUser(userId: number) {
    return Array.from(this.reviews.values()).filter(r => r.revieweeId === userId);
  }
  createReview(data: InsertReview): Review {
    const review: Review = { id: this.reviewIdCounter++, ...data } as Review;
    this.reviews.set(review.id, review);
    return review;
  }
}

export const storage = new MemStorage();
