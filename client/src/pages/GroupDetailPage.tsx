import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ImageUploader from "@/components/ImageUploader";
import { timeAgo } from "@/lib/utils";
import {
  Users, MessageSquare, Heart, Share2, Plus,
  MoreHorizontal, TrendingUp, ImageIcon, X, Loader2
} from "lucide-react";

// ─── PostCard ─────────────────────────────────────────────────
function PostCard({ post, currentUserId }: { post: any; currentUserId?: number }) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);

  const { mutate: toggleLike } = useMutation({
    mutationFn: () => apiRequest("POST", `/api/posts/${post.id}/like`).then(r => r.json()),
    onSuccess: (data) => {
      setLiked(data.liked);
      setLikes(data.likes);
    },
    onError: () => toast({ title: "Sign in to like posts", variant: "destructive" }),
  });

  const handleLike = () => {
    if (!currentUserId) {
      toast({ title: "Sign in required", description: "Sign in to like posts." });
      return;
    }
    // Optimistic toggle
    setLiked(l => !l);
    setLikes((n: number) => liked ? n - 1 : n + 1);
    toggleLike();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4" data-testid={`card-post-${post.id}`}>
      {/* Author row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Link href={`/profile/${post.author?.id}`}>
            <Avatar className="w-9 h-9 cursor-pointer">
              <AvatarImage src={post.author?.avatar} />
              <AvatarFallback>{post.author?.displayName?.[0]}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link href={`/profile/${post.author?.id}`}>
              <span className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer">
                {post.author?.displayName}
              </span>
            </Link>
            <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-line">{post.content}</p>

      {/* Images */}
      {post.images?.length > 0 && (
        <div className={`grid gap-1.5 mb-3 ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.images.slice(0, 4).map((img: string, i: number) => (
            <div key={i} className="relative rounded-lg overflow-hidden aspect-video bg-secondary">
              <img src={img} alt="" className="w-full h-full object-cover" />
              {i === 3 && post.images.length > 4 && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <span className="text-xl font-bold">+{post.images.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <button
          data-testid={`button-like-post-${post.id}`}
          onClick={handleLike}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Heart className={`w-4 h-4 transition-colors ${liked ? "fill-red-500 text-red-500" : ""}`} />
          {likes.toLocaleString()}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          <MessageSquare className="w-4 h-4" />
          {(post.commentCount || 0).toLocaleString()} comments
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-auto">
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}

// ─── Post Composer ────────────────────────────────────────────
function PostComposer({ groupId, user }: { groupId: number; user: any }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [showImages, setShowImages] = useState(false);

  const { mutate: submitPost, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/groups/${groupId}/posts`, {
        content: content.trim(),
        images: imageIds,
      }).then(r => r.json()),
    onSuccess: (newPost) => {
      queryClient.setQueryData<any[]>(["/api/groups", groupId, "posts"], old =>
        [{ ...newPost, author: user }, ...(old || [])]
      );
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      setContent("");
      setImageIds([]);
      setShowImages(false);
      setExpanded(false);
      toast({ title: "Posted!", description: "Your post is live in the group." });
    },
    onError: () => toast({ title: "Error", description: "Could not post. Try again.", variant: "destructive" }),
  });

  if (!expanded) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 mb-5">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 bg-secondary rounded-full px-4 py-2 text-sm text-muted-foreground text-left hover:bg-secondary/80 transition-colors"
            data-testid="input-post-stub"
          >
            Share something with the group...
          </button>
          <Button
            size="icon" variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => setExpanded(true)}
            data-testid="button-new-post"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm">{user.displayName}</span>
        </div>
        <button onClick={() => { setExpanded(false); setContent(""); setImageIds([]); setShowImages(false); }}>
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </div>

      <Textarea
        data-testid="input-post-content"
        autoFocus
        placeholder="What's on your mind?"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        className="bg-secondary border-border resize-none"
      />

      {showImages && (
        <ImageUploader
          value={imageIds}
          onChange={setImageIds}
          maxImages={4}
          label="Photos"
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowImages(s => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          data-testid="button-toggle-post-images"
        >
          <ImageIcon className="w-4 h-4" />
          {showImages ? "Hide photos" : "Add photos"}
        </button>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setExpanded(false); setContent(""); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!content.trim() || isPending}
            onClick={() => submitPost()}
            data-testid="button-submit-post"
            className="font-semibold"
          >
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Posting...</> : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── GroupDetailPage ──────────────────────────────────────────
export default function GroupDetailPage({ id }: { id: number }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: group, isLoading: groupLoading } = useQuery<any>({
    queryKey: ["/api/groups", id],
    queryFn: () => apiRequest("GET", `/api/groups/${id}`).then(r => r.json()),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "posts"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/posts`).then(r => r.json()),
  });

  // Check membership
  const { data: membershipData } = useQuery<{ isMember: boolean }>({
    queryKey: ["/api/groups", id, "membership"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/membership`).then(r => r.json()),
    enabled: isAuthenticated,
  });
  const isMember = membershipData?.isMember ?? false;

  const { mutate: toggleMembership, isPending: joiningLeaving } = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/groups/${id}/${isMember ? "leave" : "join"}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id] });
      toast({
        title: isMember ? "Left group" : "Joined group!",
        description: isMember ? "You've left this group." : "You're now a member.",
      });
    },
    onError: () => toast({ title: "Error", description: "Could not update membership.", variant: "destructive" }),
  });

  const handleJoinLeave = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Sign in to join groups." });
      return;
    }
    toggleMembership();
  };

  if (groupLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Skeleton className="h-48 rounded-xl mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!group) return <div className="p-8 text-center text-muted-foreground">Group not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Cover + header */}
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-5">
        <div className="relative h-48 bg-secondary">
          {group.coverImage ? (
            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🏁</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="px-5 pb-5 -mt-6 relative">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-display text-2xl font-extrabold text-foreground mb-1">{group.name}</h1>
              <p className="text-muted-foreground text-sm mb-2">{group.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{(group.memberCount || 0).toLocaleString()} members</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{(group.postCount || 0).toLocaleString()} posts</span>
                <Badge className="text-xs">{group.category}</Badge>
              </div>
            </div>
            <Button
              data-testid="button-join-group"
              onClick={handleJoinLeave}
              disabled={joiningLeaving}
              variant={isMember ? "outline" : "default"}
              className="shrink-0"
            >
              {joiningLeaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isMember ? "Leave Group" : "Join Group"
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Post composer — only for members */}
      {isMember && user && <PostComposer groupId={id} user={user} />}

      {/* Non-member nudge */}
      {!isMember && isAuthenticated && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 mb-5 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Join this group to post and interact with members.</p>
          <Button size="sm" onClick={handleJoinLeave} disabled={joiningLeaving} className="shrink-0">
            Join Group
          </Button>
        </div>
      )}

      {/* Posts feed */}
      <div className="space-y-4">
        {postsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-semibold">No posts yet</p>
            <p className="text-sm mt-1">{isMember ? "Be the first to post in this group." : "Join to start posting."}</p>
          </div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} currentUserId={user?.id} />)
        )}
      </div>
    </div>
  );
}
