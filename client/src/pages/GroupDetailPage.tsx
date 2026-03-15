import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useState } from "react";
import { Users, MessageSquare, Heart, Share2, Plus, MoreHorizontal, TrendingUp } from "lucide-react";

function PostCard({ post }: { post: any }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);

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
            <p className="text-xs text-muted-foreground">{post.createdAt}</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed mb-3">{post.content}</p>

      {/* Image */}
      {post.images?.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-3 aspect-video bg-secondary">
          <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <button
          data-testid={`button-like-post-${post.id}`}
          onClick={() => { setLiked(l => !l); setLikes((n: number) => liked ? n - 1 : n + 1); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
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

export default function GroupDetailPage({ id }: { id: number }) {
  const [joined, setJoined] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery<any>({
    queryKey: ["/api/groups", id],
    queryFn: () => apiRequest("GET", `/api/groups/${id}`).then(r => r.json()),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "posts"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/posts`).then(r => r.json()),
  });

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
        <div className="relative h-48">
          {group.coverImage && (
            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="px-5 pb-5 -mt-6 relative">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-display text-2xl font-extrabold text-foreground mb-1">{group.name}</h1>
              <p className="text-muted-foreground text-sm mb-2">{group.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{(group.memberCount||0).toLocaleString()} members</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{(group.postCount||0).toLocaleString()} posts</span>
                <Badge className="text-xs">{group.category}</Badge>
              </div>
            </div>
            <Button
              data-testid="button-join-group"
              onClick={() => setJoined(j => !j)}
              variant={joined ? "outline" : "default"}
              className="shrink-0"
            >
              {joined ? "Joined ✓" : "Join Group"}
            </Button>
          </div>
        </div>
      </div>

      {/* Write post (stub) */}
      {joined && (
        <div className="bg-card rounded-xl border border-border p-4 mb-5">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://i.pravatar.cc/150?img=11" />
              <AvatarFallback>J</AvatarFallback>
            </Avatar>
            <div
              className="flex-1 bg-secondary rounded-full px-4 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
              data-testid="input-post-stub"
            >
              Share something with the group...
            </div>
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" data-testid="button-new-post">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
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
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-semibold mb-1">No posts yet</p>
            <p className="text-sm">Be the first to post in this group.</p>
          </div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}
