import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CheckCircle,
  MapPin,
  Globe,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Youtube,
  UserPlus,
  UserMinus,
  Star,
  Users,
  MessageSquare,
  Image as ImageIcon,
  ChevronLeft,
  Loader2,
  Send,
  Tag,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BusinessPageProps {
  slug: string;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

// ── Star Rating ───────────────────────────────────────────────
function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= (hover || value) ? "text-yellow-400 fill-yellow-400" : "text-white/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────
function PostCard({ post }: { post: any }) {
  return (
    <div className="border border-white/8 rounded-2xl bg-white/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        {post.author?.avatar ? (
          <img src={post.author.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-white/60">
              {post.author?.display_name?.[0] || "?"}
            </span>
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-white">{post.author?.display_name || post.author?.username}</div>
          <div className="text-xs text-white/40">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>
      <p className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
      {post.images?.length > 0 && (
        <div className={`grid gap-1.5 mt-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.images.slice(0, 4).map((img: string, i: number) => (
            <img key={i} src={img} alt="" className="rounded-lg w-full h-40 object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────
function ReviewCard({ review }: { review: any }) {
  return (
    <div className="border border-white/8 rounded-2xl bg-white/3 p-4">
      <div className="flex items-start gap-3">
        {review.reviewer?.avatar ? (
          <img src={review.reviewer.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white/60">
              {review.reviewer?.display_name?.[0] || "?"}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium text-sm text-white">{review.reviewer?.display_name || review.reviewer?.username}</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
              ))}
            </div>
          </div>
          {review.body && <p className="text-white/60 text-sm leading-relaxed">{review.body}</p>}
          <p className="text-xs text-white/30 mt-1">
            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Listing Mini Card ─────────────────────────────────────────
function ListingMiniCard({ listing, onClick }: { listing: any; onClick: () => void }) {
  const imageUrl = listing.images?.[0] || null;
  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-white/8 bg-white/3 overflow-hidden cursor-pointer hover:bg-white/5 transition-colors"
    >
      <div className="h-28 bg-white/5">
        {imageUrl ? (
          <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-8 h-8 text-white/15" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-white text-xs font-semibold truncate">{listing.title}</p>
        <p className="text-orange-400 text-xs font-bold mt-0.5">
          ${Number(listing.price).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export function BusinessPage({ slug }: BusinessPageProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const cfUrl = useCfUrl();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [postContent, setPostContent] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");

  // ── Queries ───────────────────────────────────────────────
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["/api/business", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business/${slug}`);
      return res.json();
    },
  });

  const { data: followStatus } = useQuery({
    queryKey: ["/api/business/follow-status", page?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business/${page!.id}/follow-status`);
      return res.json();
    },
    enabled: !!user && !!page?.id,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/business/posts", page?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business/${page!.id}/posts`);
      return res.json();
    },
    enabled: !!page?.id,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["/api/business/reviews", page?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business/${page!.id}/reviews`);
      return res.json();
    },
    enabled: !!page?.id,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["/api/business/listings", page?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business/${page!.id}/listings`);
      return res.json();
    },
    enabled: !!page?.id,
  });

  // ── Mutations ─────────────────────────────────────────────
  const followMutation = useMutation({
    mutationFn: async (isFollowing: boolean) => {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await apiRequest(method, `/api/business/${page!.id}/follow`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/business/follow-status", page?.id] });
      qc.invalidateQueries({ queryKey: ["/api/business", slug] });
    },
    onError: () => toast({ title: "Error", description: "Could not update follow status", variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/business/${page!.id}/posts`, { content });
      return res.json();
    },
    onSuccess: () => {
      setPostContent("");
      qc.invalidateQueries({ queryKey: ["/api/business/posts", page?.id] });
      toast({ title: "Post published" });
    },
    onError: () => toast({ title: "Error posting", variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/business/${page!.id}/reviews`, {
        rating: reviewRating,
        body: reviewBody.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setReviewDialogOpen(false);
      setReviewRating(5);
      setReviewBody("");
      qc.invalidateQueries({ queryKey: ["/api/business/reviews", page?.id] });
      toast({ title: "Review submitted" });
    },
    onError: () => toast({ title: "Error submitting review", variant: "destructive" }),
  });

  // ── Loading State ─────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Skeleton className="h-48 rounded-2xl bg-white/5 mb-4" />
        <Skeleton className="h-20 rounded-xl bg-white/5 mb-3" />
        <Skeleton className="h-40 rounded-xl bg-white/5" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">Business page not found</p>
          <Button variant="ghost" onClick={() => navigate("/business")} className="mt-3 text-orange-400">
            Browse businesses
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === page.owner_id || (user as any)?.siteRole === "super_admin";
  const isFollowing = followStatus?.following ?? false;
  const resolveImg = (id: string | null | undefined) => {
    if (!id) return null;
    if (id.startsWith("data:") || id.startsWith("http")) return id;
    return cfImageUrl(cfUrl, id);
  };
  const logoSrc = resolveImg(page.logo_id);
  const coverSrc = resolveImg(page.cover_id);
  const posts: any[] = postsData?.posts || [];

  // Average rating
  const avgRating = reviews.length
    ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => navigate("/business")}
        className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All Businesses
      </button>

      {/* Cover photo */}
      <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-900/30 to-zinc-800/60 mb-0">
        {coverSrc && (
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
        )}
        {isOwner && (
          <button
            onClick={() => navigate(`/business/${slug}/edit`)}
            className="absolute top-3 right-3 flex items-center gap-1.5 text-xs bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Edit Page
          </button>
        )}
      </div>

      {/* Info row */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 px-4 mb-5 relative z-10">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl border-4 border-[#0f1014] bg-zinc-900 flex items-center justify-center overflow-hidden shadow-xl flex-shrink-0">
          {logoSrc ? (
            <img src={logoSrc} alt={page.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-9 h-9 text-orange-400" />
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white">{page.name}</h1>
            {page.verified && (
              <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> Verified
              </div>
            )}
            <span className="text-xs text-white/50 bg-white/8 px-2 py-0.5 rounded-full">{page.category}</span>
          </div>
          {page.tagline && <p className="text-white/60 text-sm mt-0.5">{page.tagline}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-white/40">
            {(page.city || page.state) && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[page.city, page.state].filter(Boolean).join(", ")}</span>
            )}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(page.follower_count || 0).toLocaleString()} followers</span>
            {avgRating && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {avgRating} ({reviews.length} reviews)
              </span>
            )}
          </div>
        </div>

        {/* Follow button */}
        {user && !isOwner && (
          <Button
            data-testid="btn-follow-business"
            onClick={() => followMutation.mutate(isFollowing)}
            disabled={followMutation.isPending}
            variant={isFollowing ? "outline" : "default"}
            className={isFollowing
              ? "border-white/20 text-white/70 hover:text-red-400 hover:border-red-400/40 gap-1.5"
              : "bg-orange-500 hover:bg-orange-600 text-white gap-1.5"}
            size="sm"
          >
            {followMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
              <><UserMinus className="w-4 h-4" /> Following</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Follow</>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="bg-white/5 border border-white/8 mb-5 w-full sm:w-auto">
          <TabsTrigger value="posts" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60 gap-1.5">
            <MessageSquare className="w-4 h-4" />Posts
            {posts.length > 0 && <span className="text-xs opacity-70">({posts.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60">
            About
          </TabsTrigger>
          <TabsTrigger value="listings" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60 gap-1.5">
            <Tag className="w-4 h-4" />Listings
            {listings.length > 0 && <span className="text-xs opacity-70">({listings.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60 gap-1.5">
            <Star className="w-4 h-4" />Reviews
            {reviews.length > 0 && <span className="text-xs opacity-70">({reviews.length})</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── POSTS tab ──────────────────────────────────────── */}
        <TabsContent value="posts">
          {/* Owner compose box */}
          {isOwner && (
            <div className="border border-white/8 rounded-2xl bg-white/3 p-4 mb-5">
              <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">Post as {page.name}</p>
              <Textarea
                data-testid="textarea-business-post"
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="Share an update, announcement, special offer…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none min-h-[80px] mb-3"
                maxLength={2000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30">{postContent.length}/2000</span>
                <Button
                  data-testid="btn-publish-post"
                  onClick={() => postContent.trim() && postMutation.mutate(postContent.trim())}
                  disabled={!postContent.trim() || postMutation.isPending}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                >
                  {postMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Send className="w-4 h-4" />Publish</>
                  }
                </Button>
              </div>
            </div>
          )}

          {postsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)}
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post: any) => <PostCard key={post.id} post={post} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-10 h-10 text-white/15 mb-3" />
              <p className="text-white/50 text-sm">No posts yet</p>
              {isOwner && <p className="text-white/30 text-xs mt-1">Share your first update above</p>}
            </div>
          )}
        </TabsContent>

        {/* ── ABOUT tab ──────────────────────────────────────── */}
        <TabsContent value="about">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Description */}
            {page.description && (
              <div className="md:col-span-2 border border-white/8 rounded-2xl bg-white/3 p-5">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">About</h3>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{page.description}</p>
              </div>
            )}

            {/* Contact */}
            <div className="border border-white/8 rounded-2xl bg-white/3 p-5">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-2.5">
                {page.phone && (
                  <a href={`tel:${page.phone}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-orange-400 transition-colors">
                    <Phone className="w-4 h-4 text-white/30" /> {page.phone}
                  </a>
                )}
                {page.email && (
                  <a href={`mailto:${page.email}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-orange-400 transition-colors">
                    <Mail className="w-4 h-4 text-white/30" /> {page.email}
                  </a>
                )}
                {page.website && (
                  <a href={page.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-white/70 hover:text-orange-400 transition-colors">
                    <Globe className="w-4 h-4 text-white/30" /> {page.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {(page.address || page.city) && (
                  <div className="flex items-start gap-2 text-sm text-white/70">
                    <MapPin className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                    <span>
                      {[page.address, page.city, page.state, page.zip].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Social */}
            {(page.instagram || page.facebook || page.youtube) && (
              <div className="border border-white/8 rounded-2xl bg-white/3 p-5">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Social</h3>
                <div className="space-y-2.5">
                  {page.instagram && (
                    <a href={`https://instagram.com/${page.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 transition-colors">
                      <Instagram className="w-4 h-4" />
                      {page.instagram}
                    </a>
                  )}
                  {page.facebook && (
                    <a href={page.facebook.startsWith("http") ? page.facebook : `https://${page.facebook}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </a>
                  )}
                  {page.youtube && (
                    <a href={page.youtube.startsWith("http") ? page.youtube : `https://youtube.com/${page.youtube}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                      <Youtube className="w-4 h-4" />
                      YouTube
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Hours */}
            {page.hours && Object.keys(page.hours).length > 0 && (
              <div className="border border-white/8 rounded-2xl bg-white/3 p-5">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Hours</h3>
                <div className="space-y-1.5">
                  {DAYS.map(day => page.hours[day] && (
                    <div key={day} className="flex items-center justify-between text-sm">
                      <span className="text-white/50 w-24">{DAY_LABELS[day]}</span>
                      <span className="text-white/80">{page.hours[day]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Owner info */}
            {page.owner && (
              <div className="border border-white/8 rounded-2xl bg-white/3 p-5">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Page Owner</h3>
                <div className="flex items-center gap-3">
                  {page.owner.avatar ? (
                    <img src={page.owner.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-white/60">{page.owner.display_name?.[0] || "?"}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{page.owner.display_name || page.owner.username}</p>
                    <p className="text-xs text-white/40">@{page.owner.username}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── LISTINGS tab ───────────────────────────────────── */}
        <TabsContent value="listings">
          {listingsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-xl bg-white/5" />)}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {listings.map((l: any) => (
                <ListingMiniCard key={l.id} listing={l} onClick={() => navigate(`/listing/${l.id}`)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tag className="w-10 h-10 text-white/15 mb-3" />
              <p className="text-white/50 text-sm">No active listings</p>
            </div>
          )}
        </TabsContent>

        {/* ── REVIEWS tab ────────────────────────────────────── */}
        <TabsContent value="reviews">
          {/* Rating summary */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-4 p-4 border border-white/8 rounded-2xl bg-white/3 mb-5">
              <div className="text-4xl font-bold text-white">{avgRating}</div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= Math.round(Number(avgRating)) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
                  ))}
                </div>
                <p className="text-xs text-white/50">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          )}

          {/* Write review button */}
          {user && !isOwner && (
            <Button
              data-testid="btn-write-review"
              onClick={() => setReviewDialogOpen(true)}
              className="mb-5 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 gap-1.5"
              variant="outline"
            >
              <Star className="w-4 h-4" /> Write a Review
            </Button>
          )}

          {reviewsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl bg-white/5" />)}
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((r: any) => <ReviewCard key={r.id} review={r} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Star className="w-10 h-10 text-white/15 mb-3" />
              <p className="text-white/50 text-sm">No reviews yet</p>
              {user && !isOwner && (
                <p className="text-white/30 text-xs mt-1">Be the first to review this business</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Review {page.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm text-white/60 mb-2">Your rating</p>
              <StarRow value={reviewRating} onChange={setReviewRating} />
            </div>
            <div>
              <p className="text-sm text-white/60 mb-2">Your review (optional)</p>
              <Textarea
                data-testid="textarea-review-body"
                value={reviewBody}
                onChange={e => setReviewBody(e.target.value)}
                placeholder="Share your experience…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none min-h-[90px]"
                maxLength={500}
              />
            </div>
            <Button
              data-testid="btn-submit-review"
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {reviewMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "Submit Review"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
