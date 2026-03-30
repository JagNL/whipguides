/**
 * FeedPage — /feed
 *
 * The community heart of WhipGuides. Think of it as Facebook's News Feed
 * but purpose-built for real enthusiast communities:
 *
 * - Posts flow from every group you're in + people you follow
 * - Infinite scroll with cursor-based pagination (no pagination clicks)
 * - Ads blend in as native posts, not jarring banners
 * - Rich reactions (not just a thumbs up)
 * - Inline post composer — post to any of your groups without leaving feed
 * - Group context chip on every post — "From: C5 Corvette Builds"
 * - Discovery mode when you haven't joined anything yet
 * - "WhipGuides knows you" — the more you engage, the better it gets
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ReportButton from "@/components/ReportButton";
import { useCfUrl } from "@/hooks/use-cf-url";
import {
  Heart, MessageSquare, Share2, MoreHorizontal,
  Flame, Laugh, Star, Zap, Smile, Plus,
  Users, Compass, TrendingUp, ChevronRight,
  ImageIcon, BookOpen, Tag, X, Loader2,
  ExternalLink, Globe,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PostImageGrid } from "@/components/ImageLightbox";

// ─── Reaction system ──────────────────────────────────────────
const REACTIONS = [
  { key: "like",    emoji: "👍", label: "Like",    icon: Heart },
  { key: "love",    emoji: "❤️", label: "Love",    icon: Heart },
  { key: "fire",    emoji: "🔥", label: "Fire",    icon: Flame },
  { key: "helpful", emoji: "🔧", label: "Helpful", icon: Star },
  { key: "haha",    emoji: "😂", label: "Haha",    icon: Laugh },
  { key: "wow",     emoji: "😮", label: "Wow",     icon: Zap },
] as const;

type ReactionKey = typeof REACTIONS[number]["key"];

function ReactionButton({
  postId,
  reactionCounts = {},
  totalLikes = 0,
}: {
  postId: number;
  reactionCounts: Record<string, number>;
  totalLikes: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [myReaction, setMyReaction] = useState<ReactionKey | null>(null);
  const timerRef = useRef<any>(null);

  const { data: myReactionData } = useQuery<any>({
    queryKey: ["/api/posts", postId, "my-reaction"],
    queryFn: () => apiRequest("GET", `/api/posts/${postId}/my-reaction`).then(r => r.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (myReactionData?.reaction) setMyReaction(myReactionData.reaction);
  }, [myReactionData]);

  const reactMut = useMutation({
    mutationFn: (reaction: ReactionKey) =>
      apiRequest("POST", `/api/posts/${postId}/react`, { reaction }).then(r => r.json()),
    onSuccess: (_, reaction) => {
      setMyReaction(reaction);
      qc.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const unreactMut = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/posts/${postId}/react`).then(r => r.json()),
    onSuccess: () => {
      setMyReaction(null);
      qc.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const topReactions = Object.entries(reactionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => REACTIONS.find(r => r.key === k)?.emoji)
    .filter(Boolean);

  const handleHold = () => {
    timerRef.current = setTimeout(() => setShowPicker(true), 300);
  };
  const handleRelease = () => {
    clearTimeout(timerRef.current);
    if (!showPicker) {
      if (myReaction) unreactMut.mutate();
      else reactMut.mutate("like");
    }
  };

  return (
    <div className="relative">
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 bg-card border border-border rounded-2xl shadow-xl p-1.5 flex gap-1">
            {REACTIONS.map(r => (
              <button
                key={r.key}
                onClick={() => { reactMut.mutate(r.key); setShowPicker(false); }}
                className={`group flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all hover:bg-muted/60 hover:scale-125 ${myReaction === r.key ? "bg-primary/15" : ""}`}
                title={r.label}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                <span className="text-[9px] text-muted-foreground group-hover:text-foreground">{r.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button
        onMouseDown={handleHold}
        onMouseUp={handleRelease}
        onMouseLeave={() => clearTimeout(timerRef.current)}
        onTouchStart={handleHold}
        onTouchEnd={handleRelease}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all select-none
          ${myReaction ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
      >
        {myReaction ? (
          <span className="text-base leading-none">{REACTIONS.find(r => r.key === myReaction)?.emoji}</span>
        ) : (
          <Heart className="w-4 h-4" />
        )}
        <span>{totalLikes > 0 ? totalLikes : ""}</span>
        {topReactions.length > 0 && totalLikes > 1 && (
          <span className="text-xs text-muted-foreground ml-0.5">{topReactions.join("")}</span>
        )}
      </button>
    </div>
  );
}

// ─── Native Ad Post (blends into feed as a post) ─────────────
function AdFeedPost({ ad, onDismiss }: { ad: any; onDismiss: () => void }) {
  const cfBase = useCfUrl();
  const imgSrc = ad.imageId && cfBase ? `${cfBase}/${ad.imageId}/public` : ad.imageUrl || null;

  const handleClick = () => {
    apiRequest("POST", `/api/ads/${ad.id}/click`).catch(() => {});
    window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-card border border-border/40 border-dashed rounded-2xl overflow-hidden" data-testid={`feed-ad-${ad.id}`}>
      {/* Post header — looks like a user post */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Advertiser avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{(ad.advertiser || "Ad")[0].toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{ad.advertiser || "Sponsored"}</span>
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase bg-muted/70 px-1.5 py-0.5 rounded">Sponsored</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span>Promoted post</span>
            </div>
          </div>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Ad content */}
      <div className="px-4 pb-3 space-y-2">
        <p className="text-sm font-semibold">{ad.headline}</p>
        {ad.body && <p className="text-sm text-muted-foreground">{ad.body}</p>}
      </div>

      {/* Image */}
      {imgSrc && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-border/40">
          <img src={imgSrc} alt={ad.headline} className="w-full object-cover max-h-72" />
        </div>
      )}

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={handleClick}
          className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {ad.ctaText || "Learn More"}
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Feed Post Card ───────────────────────────────────────────
function FeedPostCard({ post, groups }: { post: any; groups: any[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const cfBase = useCfUrl();
  const qc = useQueryClient();

  const submitComment = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/groups/${post.group?.id}/posts/${post.id}/comments`, { content: comment })
        .then(r => r.json()),
    onSuccess: () => {
      setComment("");
      setShowCommentBox(false);
      toast({ title: "Comment posted" });
      qc.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: () => toast({ title: "Couldn't post comment", variant: "destructive" }),
  });

  const images: string[] = post.images || [];
  const authorAvatar = post.author?.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author?.username}`;

  const handleShare = () => {
    const url = `${window.location.origin}/#/groups/${post.group?.id}`;
    if (navigator.share) {
      navigator.share({ title: post.author?.display_name, text: post.content?.slice(0, 100), url });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    }
  };

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden" data-testid={`feed-post-${post.id}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/profile/${post.author?.id}`}>
            <Avatar className="w-10 h-10 shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
              <AvatarImage src={authorAvatar} />
              <AvatarFallback>{post.author?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${post.author?.id}`}>
                <span className="font-semibold text-sm hover:underline cursor-pointer">
                  {post.author?.display_name || post.author?.username}
                </span>
              </Link>
              {post.author?.verified && (
                <span className="text-primary text-xs">✓</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              {post.business_page && (
                <>
                  <Link href={`/business/${post.business_page.slug}`}>
                    <span className="hover:text-primary hover:underline cursor-pointer font-medium text-orange-400">
                      {post.business_page.name}
                    </span>
                  </Link>
                  <span>·</span>
                </>
              )}
              {post.group && !post.business_page && (
                <>
                  <Link href={`/groups/${post.group.id}`}>
                    <span className="hover:text-primary hover:underline cursor-pointer font-medium">
                      {post.group.name}
                    </span>
                  </Link>
                  <span>·</span>
                </>
              )}
              <span>{timeAgo(post.created_at)}</span>
              {post.business_page?.category && (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-orange-500/30 text-orange-400">
                  {post.business_page.category}
                </Badge>
              )}
              {post.group?.category && !post.business_page && (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">
                  {post.group.category}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <ReportButton targetType="post" targetId={post.id} iconOnly />
          <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Images — resolved URLs, then lightbox-enabled grid */}
      {images.length > 0 && (
        <div className="px-4 mb-3">
          <PostImageGrid
            images={images.map((id: string) =>
              id.startsWith("data:") || id.startsWith("http") ? id
              : cfBase ? `${cfBase}/${id}` : id
            )}
          />
        </div>
      )}

      {/* Guide link — full embed requires fetching the guide object; show a clickable pill instead */}
      {post.guide_id && (
        <div className="px-4 pb-3">
          <Link href={`/guides/${post.guide_id}`}>
            <div className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 border border-border rounded-xl px-3 py-2.5 cursor-pointer transition-colors">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium">View attached guide</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
          </Link>
        </div>
      )}

      {/* Reaction bar */}
      {(Object.keys(post.reaction_counts || {}).length > 0 || post.likes > 0) && (
        <div className="px-4 pb-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-1.5">
            <span>
              {Object.entries(post.reaction_counts || {})
                .sort(([,a],[,b]) => (b as number) - (a as number))
                .slice(0, 3)
                .map(([k]) => REACTIONS.find(r => r.key === k)?.emoji)
                .filter(Boolean)
                .join("") || "👍"}
              {" "}{post.likes > 0 ? post.likes : ""}
            </span>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="px-2 py-1 flex items-center gap-0.5 border-b border-border">
        <ReactionButton
          postId={post.id}
          reactionCounts={post.reaction_counts || {}}
          totalLikes={post.likes || 0}
        />
        <button
          onClick={() => setShowCommentBox(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Comment</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
        <Link href={`/groups/${post.group?.id}`}>
          <button className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted/60 transition-colors">
            View in group <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>

      {/* Comment box */}
      {showCommentBox && user && (
        <div className="px-4 py-3 flex gap-2">
          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
            <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
            <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="text-sm resize-none bg-secondary border-0"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (comment.trim()) submitComment.mutate();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowCommentBox(false)}>Cancel</Button>
              <Button size="sm" className="h-7" disabled={!comment.trim() || submitComment.isPending}
                onClick={() => submitComment.mutate()}>
                {submitComment.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Feed Composer ───────────────────────────────────────────
function FeedComposer({ groups }: { groups: any[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const postMut = useMutation({
    mutationFn: () => {
      if (!selectedGroupId) throw new Error("Select a group to post in");
      return apiRequest("POST", `/api/groups/${selectedGroupId}/posts`, { content, images: [] })
        .then(r => r.json());
    },
    onSuccess: () => {
      setContent("");
      setExpanded(false);
      setSelectedGroupId(null);
      qc.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({ title: "Posted to your group" });
    },
    onError: (e: any) => toast({ title: "Couldn't post", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  const avatar = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex gap-3 items-center">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={avatar} />
          <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <button
          onClick={() => setExpanded(true)}
          className="flex-1 bg-secondary hover:bg-secondary/80 text-muted-foreground text-sm text-left rounded-full px-4 py-2.5 transition-colors"
        >
          {`What's on your mind, ${user.displayName?.split(" ")[0] || user.username}?`}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <Textarea
            autoFocus
            placeholder={`Share something with your communities...`}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            className="resize-none bg-secondary border-0 text-sm"
          />

          {/* Group picker */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Post to:</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(selectedGroupId === g.id ? null : g.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selectedGroupId === g.id
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {g.name}
                </button>
              ))}
              {groups.length === 0 && (
                <Link href="/groups">
                  <span className="text-xs text-primary hover:underline cursor-pointer">
                    Join a group to start posting
                  </span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted/60 rounded-lg transition-colors" title="Add photo">
                <ImageIcon className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted/60 rounded-lg transition-colors" title="Share a guide">
                <BookOpen className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted/60 rounded-lg transition-colors" title="Share a listing">
                <Tag className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setExpanded(false); setContent(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!content.trim() || !selectedGroupId || postMut.isPending}
                onClick={() => postMut.mutate()}
              >
                {postMut.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!expanded && (
        <div className="flex gap-2 pt-1 border-t border-border">
          {[
            { icon: ImageIcon, label: "Photo" },
            { icon: BookOpen, label: "Guide" },
            { icon: Tag, label: "Listing" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setExpanded(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-lg transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Discovery Banner (shown when user has no groups) ─────────
function DiscoveryBanner() {
  return (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Your feed grows with your communities</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Join groups that match your interests — cars, trucks, 3D printing, firearms, antiques, and more.
        Everything you see here comes from real people in real communities. No algorithm-pushed content you didn't ask for.
      </p>
      <div className="flex gap-2">
        <Link href="/groups">
          <Button size="sm">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Browse Groups
          </Button>
        </Link>
        <Link href="/guides">
          <Button size="sm" variant="outline">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Explore Guides
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────
function FeedSidebar({ myGroups }: { myGroups: any[] }) {
  return (
    <aside className="space-y-4">
      {/* Your groups quick-nav */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Your Groups</h3>
          <Link href="/groups">
            <span className="text-xs text-primary hover:underline cursor-pointer">See all</span>
          </Link>
        </div>
        {myGroups.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Join groups to see them here</p>
            <Link href="/groups">
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">Find Groups</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {myGroups.slice(0, 8).map(g => (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary overflow-hidden">
                    {(g.avatar || g.coverImage) ? (
                      <img src={g.avatar || g.coverImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      g.name?.[0]?.toUpperCase() ?? "G"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{g.name}</p>
                    {g.category && <p className="text-[10px] text-muted-foreground truncate">{g.category}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Trending / suggestions */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Discover More</h3>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <Link href="/groups"><div className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors group"><Users className="w-3.5 h-3.5 group-hover:text-primary" /> Browse all groups</div></Link>
          <Link href="/guides"><div className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors group"><BookOpen className="w-3.5 h-3.5 group-hover:text-primary" /> Explore how-to guides</div></Link>
          <Link href="/"><div className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors group"><Tag className="w-3.5 h-3.5 group-hover:text-primary" /> Browse marketplace</div></Link>
          <Link href="/advertise"><div className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors group"><Star className="w-3.5 h-3.5 group-hover:text-primary" /> Advertise on WhipGuides</div></Link>
        </div>
      </div>
    </aside>
  );
}

// ─── Feed Skeleton ────────────────────────────────────────────
function FeedPostSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main FeedPage ────────────────────────────────────────────
export default function FeedPage() {
  const { user, isAuthenticated } = useAuth();
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [dismissedAds, setDismissedAds] = useState<number[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // My groups (for composer + sidebar)
  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/mine"],
    queryFn: () => apiRequest("GET", "/api/groups/mine").then(r => r.json()),
    enabled: isAuthenticated,
  });

  // Initial feed load
  const { data: initialFeed, isLoading } = useQuery<any>({
    queryKey: ["/api/feed"],
    queryFn: () => apiRequest("GET", "/api/feed?limit=15").then(r => r.json()),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (initialFeed?.posts) {
      setAllPosts(initialFeed.posts);
      setCursor(initialFeed.nextCursor);
      setHasMore(!!initialFeed.nextCursor);
    }
  }, [initialFeed]);

  // Ads
  const { data: feedAds = [] } = useQuery<any[]>({
    queryKey: ["/api/ads/serve", "feed"],
    queryFn: () => {
      const interests = (myGroups || []).map((g: any) => g.category).filter(Boolean).join(",");
      return apiRequest("GET", `/api/ads/serve?context=feed&interests=${encodeURIComponent(interests)}&limit=4`)
        .then(r => r.json());
    },
    staleTime: 120_000,
    enabled: isAuthenticated,
  });

  const activeAds = feedAds.filter((a: any) => !dismissedAds.includes(a.id));

  // Infinite scroll observer
  const loadMore = useCallback(async () => {
    if (!cursor || isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const res = await apiRequest("GET", `/api/feed?cursor=${encodeURIComponent(cursor)}&limit=10`);
      const data = await res.json();
      if (data.posts?.length) {
        setAllPosts(prev => [...prev, ...data.posts]);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      } else {
        setHasMore(false);
      }
    } finally {
      setIsFetchingMore(false);
    }
  }, [cursor, isFetchingMore, hasMore]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Build the feed items: inject ad every 7 posts
  const feedItems: any[] = [];
  let adIdx = 0;
  allPosts.forEach((post, i) => {
    feedItems.push({ type: "post", data: post });
    if ((i + 1) % 7 === 0 && adIdx < activeAds.length) {
      feedItems.push({ type: "ad", data: activeAds[adIdx++] });
    }
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Your Community Feed</h1>
        <p className="text-muted-foreground">Sign in to see posts from your groups and the people you follow.</p>
        <p className="text-sm text-muted-foreground">WhipGuides is built around real communities — not a firehose of content you didn't ask for.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main feed column */}
        <div className="space-y-4 min-w-0">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Feed</h1>
              {initialFeed?.isDiscovery && (
                <p className="text-xs text-muted-foreground">Showing posts from public groups to help you discover communities</p>
              )}
            </div>
          </div>

          {/* Composer */}
          <FeedComposer groups={myGroups} />

          {/* Discovery CTA when no groups */}
          {!isLoading && allPosts.length === 0 && myGroups.length === 0 && (
            <DiscoveryBanner />
          )}

          {/* Feed */}
          {isLoading ? (
            <>
              <FeedPostSkeleton />
              <FeedPostSkeleton />
              <FeedPostSkeleton />
            </>
          ) : (
            <>
              {feedItems.map((item, i) => {
                if (item.type === "ad") {
                  return (
                    <AdFeedPost
                      key={`ad-${item.data.id}-${i}`}
                      ad={item.data}
                      onDismiss={() => setDismissedAds(d => [...d, item.data.id])}
                    />
                  );
                }
                return <FeedPostCard key={`post-${item.data.id}`} post={item.data} groups={myGroups} />;
              })}

              {/* Empty state when no posts yet but has groups */}
              {allPosts.length === 0 && myGroups.length > 0 && (
                <div className="text-center py-16 text-muted-foreground space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-7 h-7 opacity-40" />
                  </div>
                  <p className="font-semibold">Nothing in your feed yet</p>
                  <p className="text-sm">
                    Your groups don't have recent posts, or you're the first to post.<br />
                    Be the spark — write something above.
                  </p>
                </div>
              )}

              {/* Infinite scroll sentinel */}
              <div ref={bottomRef} className="h-4" />

              {isFetchingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!hasMore && allPosts.length > 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <p>You're all caught up.</p>
                  <div className="flex justify-center gap-2">
                    <Link href="/groups">
                      <Button size="sm" variant="outline">
                        <Users className="w-3.5 h-3.5 mr-1.5" /> Discover Groups
                      </Button>
                    </Link>
                    <Link href="/">
                      <Button size="sm" variant="outline">
                        <Tag className="w-3.5 h-3.5 mr-1.5" /> Browse Marketplace
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <FeedSidebar myGroups={myGroups} />
          </div>
        </div>
      </div>
    </div>
  );
}
