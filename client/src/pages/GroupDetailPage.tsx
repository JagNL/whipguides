import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ImageUploader from "@/components/ImageUploader";
import { GuideEmbedCard } from "@/components/GuideEmbedCard";
import { PostImageGrid } from "@/components/ImageLightbox";
import { GroupSettingsSheet } from "@/components/GroupSettingsSheet";
import { VideoUploader, type VideoUploadResult } from "@/components/VideoUploader";
import { VideoPlayer, VideoThumbnail } from "@/components/VideoPlayer";
import { useAppConfig } from "@/hooks/use-cf-url";
import { timeAgo } from "@/lib/utils";
import {
  Users, MessageSquare, Heart, Share2, Plus,
  MoreHorizontal, TrendingUp, ImageIcon, X, Loader2,
  BookOpen, Search, Wrench, ChevronRight, Star, MapPin, UserCheck,
  Lock, Clock, CheckCircle2, XCircle, UserPlus, Eye, EyeOff, Shield,
  Trash2, Settings, Crown, UserMinus, ShieldCheck, AlertTriangle,
  Pin, Flag, Video, CalendarDays,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// ─── Guide search dropdown ────────────────────────────────────
function GuideSearch({ onSelect }: { onSelect: (guide: any) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery<any[]>({
    queryKey: ["/api/guides", { search: query }],
    queryFn: () =>
      apiRequest("GET", `/api/guides?search=${encodeURIComponent(query)}`).then(r => r.json()),
    enabled: query.length >= 2,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          data-testid="input-guide-search-attach"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search guides to attach..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}>
            <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && results && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {results.map((guide: any) => (
            <button
              key={guide.id}
              data-testid={`guide-result-${guide.id}`}
              className="w-full flex items-start gap-3 p-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
              onClick={() => { onSelect(guide); setQuery(""); setOpen(false); }}
            >
              <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-1">{guide.title}</p>
                <p className="text-xs text-muted-foreground">
                  {guide.vehicleYearStart} {guide.vehicleMake} {guide.vehicleModel}
                  {" · "}
                  <span className="capitalize">{guide.difficulty}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results?.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 p-3 text-sm text-muted-foreground text-center">
          No guides found for "{query}"
        </div>
      )}
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────
function PostCard({ post, currentUserId, groupAdminRole }: {
  post: any; currentUserId?: number; groupAdminRole?: string | null;
}) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [helped, setHelped] = useState(false);
  const [helpedCount, setHelpedCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [deleted, setDeleted] = useState(false);
  const [isPinned, setIsPinned] = useState(post.isPinned || post.is_pinned || false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNote, setReportNote] = useState("");

  const isAuthor = currentUserId === post.author?.id || currentUserId === post.authorId;
  const isGroupMod = ["owner", "admin", "moderator"].includes(groupAdminRole || "");
  const isGroupAdmin = ["owner", "admin"].includes(groupAdminRole || "");

  const { mutate: toggleLike } = useMutation({
    mutationFn: () => apiRequest("POST", `/api/posts/${post.id}/like`).then(r => r.json()),
    onSuccess: (data) => { setLiked(data.liked); setLikes(data.likes); },
    onError: () => toast({ title: "Sign in to like posts", variant: "destructive" }),
  });

  const { mutate: toggleHelped } = useMutation({
    mutationFn: () => apiRequest("POST", `/api/posts/${post.id}/helped`).then(r => r.json()),
    onSuccess: (data) => { setHelped(data.helped); setHelpedCount(data.count); },
    onError: () => toast({ title: "Sign in to react", variant: "destructive" }),
  });

  const handleLike = () => {
    if (!currentUserId) { toast({ title: "Sign in required" }); return; }
    setLiked(l => !l);
    setLikes((n: number) => liked ? n - 1 : n + 1);
    toggleLike();
  };

  const handleHelped = () => {
    if (!currentUserId) { toast({ title: "Sign in required" }); return; }
    setHelped(h => !h);
    setHelpedCount(n => helped ? Math.max(0, n - 1) : n + 1);
    toggleHelped();
  };

  const { mutate: deletePost, isPending: deleting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/posts/${post.id}`);
      return res.json();
    },
    onSuccess: () => { setDeleted(true); toast({ title: "Post deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/posts/${post.id}`, { content: editContent });
      return res.json();
    },
    onSuccess: () => { setEditing(false); toast({ title: "Post updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { mutate: togglePin } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/posts/${post.id}/pin`, { pin: !isPinned });
      return res.json();
    },
    onSuccess: (data) => { setIsPinned(data.pinned); toast({ title: data.pinned ? "Post pinned" : "Post unpinned" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { mutate: submitReport, isPending: reporting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/posts/${post.id}/report`, { reason: reportReason, description: reportNote });
      return res.json();
    },
    onSuccess: () => { setReportOpen(false); setReportReason(""); setReportNote(""); toast({ title: "Report submitted", description: "Our team will review this post." }); },
  });

  if (deleted) return null;

  return (
    <div className={`bg-card rounded-xl border p-4 transition-colors ${
      isPinned ? "border-primary/40 bg-primary/5" : "border-border"
    }`} data-testid={`card-post-${post.id}`}>

      {/* Pinned banner */}
      {isPinned && (
        <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-3 -mt-1">
          <Pin className="w-3 h-3" /> Pinned Post
        </div>
      )}

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
            <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}{post.updatedAt && " · edited"}</p>
          </div>
        </div>

        {/* ⋯ dropdown menu */}
        <div className="relative">
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setMenuOpen(o => !o)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl py-1.5 w-44 text-sm">
                {/* Author actions */}
                {isAuthor && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                      onClick={() => { setEditing(true); setMenuOpen(false); }}
                    >
                      <Wrench className="w-3.5 h-3.5" /> Edit Post
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-destructive flex items-center gap-2"
                      onClick={() => { if (confirm("Delete this post?")) deletePost(); setMenuOpen(false); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Post
                    </button>
                    <div className="h-px bg-border mx-2 my-1" />
                  </>
                )}
                {/* Mod actions */}
                {isGroupMod && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                      onClick={() => { togglePin(); setMenuOpen(false); }}
                    >
                      <Pin className="w-3.5 h-3.5 text-primary" />
                      {isPinned ? "Unpin Post" : "Pin Post"}
                    </button>
                    {!isAuthor && (
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-secondary text-destructive flex items-center gap-2"
                        onClick={() => { if (confirm("Remove this post?")) deletePost(); setMenuOpen(false); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Post
                      </button>
                    )}
                    <div className="h-px bg-border mx-2 my-1" />
                  </>
                )}
                {/* Anyone can report */}
                {!isAuthor && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-secondary text-destructive flex items-center gap-2"
                    onClick={() => { setReportOpen(true); setMenuOpen(false); }}
                  >
                    <Flag className="w-3.5 h-3.5" /> Report Post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {editing ? (
        <div className="mb-3 space-y-2">
          <Textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="bg-secondary border-border text-sm resize-none min-h-[80px]"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => saveEdit()} disabled={saving || !editContent.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        /* Content */
        post.content && (
          <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-line">{post.content}</p>
        )
      )}

      {/* Report dialog */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-popover border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold mb-1">Report Post</h3>
            <p className="text-xs text-muted-foreground mb-3">Tell us what's wrong with this post.</p>
            <div className="space-y-2 mb-3">
              {["spam","harassment","hate_speech","misinformation","off_topic","inappropriate","other"].map(r => (
                <label key={r} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  reportReason === r ? "bg-primary/10 border border-primary/30" : "bg-secondary hover:bg-secondary/80"
                }`}>
                  <input type="radio" name="reason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} className="accent-primary" />
                  <span className="text-sm capitalize">{r.replace("_", " ")}</span>
                </label>
              ))}
            </div>
            <Textarea
              value={reportNote}
              onChange={e => setReportNote(e.target.value)}
              placeholder="Optional additional context..."
              className="bg-secondary border-border text-sm resize-none min-h-[60px] mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => submitReport()} disabled={!reportReason || reporting}>
                {reporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Guide embed */}
      {post.guide && <GuideEmbedCard guide={post.guide} />}

      {/* Images */}
      <PostImageGrid images={post.images || []} />

      {/* Video */}
      {(post.videoHlsUrl || post.video_hls_url) && (
        <div className="mt-3">
          <VideoPlayer
            hlsUrl={post.videoHlsUrl || post.video_hls_url}
            thumbnailUrl={post.videoThumbnailUrl || post.video_thumbnail_url}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 mt-3 border-t border-border flex-wrap">
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

        {/* "This helped me" — only shown on posts with a guide embed */}
        {post.guide && (
          <button
            data-testid={`button-helped-${post.id}`}
            onClick={handleHelped}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              helped
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-primary"
            }`}
            title="This guide helped me"
          >
            <Wrench className={`w-4 h-4 ${helped ? "text-primary" : ""}`} />
            {helped ? "Helped me" : "This helped me"}
            {helpedCount > 0 && <span className="ml-0.5">· {helpedCount}</span>}
          </button>
        )}

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
  const config = useAppConfig();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [showImages, setShowImages] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [attachedVideo, setAttachedVideo] = useState<VideoUploadResult | null>(null);
  const [showGuideSearch, setShowGuideSearch] = useState(false);
  const [attachedGuide, setAttachedGuide] = useState<any>(null);

  // @guide: autocomplete trigger
  const handleContentChange = (val: string) => {
    setContent(val);
    if (val.endsWith("@guide:") || val.includes("@guide:")) {
      setShowGuideSearch(true);
    }
  };

  const handleAttachGuide = (guide: any) => {
    setAttachedGuide(guide);
    setShowGuideSearch(false);
    // Remove the @guide: trigger text if present
    setContent(c => c.replace(/@guide:\S*/g, "").trimEnd());
  };

  const handleDetachGuide = () => setAttachedGuide(null);

  const reset = () => {
    setContent(""); setImageIds([]); setShowImages(false);
    setShowVideo(false); setAttachedVideo(null);
    setShowGuideSearch(false); setAttachedGuide(null); setExpanded(false);
  };

  const { mutate: submitPost, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/groups/${groupId}/posts`, {
        content: content.trim(),
        images: imageIds,
        guideId: attachedGuide?.id ?? null,
        videoId: attachedVideo?.videoId ?? null,
        videoHlsUrl: attachedVideo?.hlsUrl ?? null,
        videoThumbnailUrl: attachedVideo?.thumbnailUrl ?? null,
      });
      return res.json();
    },
    onSuccess: (newPost) => {
      queryClient.setQueryData<any[]>(["/api/groups", groupId, "posts"], old =>
        [{ ...newPost, author: user }, ...(old || [])]
      );
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      reset();
      toast({ title: "Posted!" });
    },
    onError: (err: any) => toast({ title: "Error posting", description: err?.message || "Could not post. Try again.", variant: "destructive" }),
  });

  const canPost = (content.trim() || attachedGuide || attachedVideo) && !isPending;

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
          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0"
            onClick={() => setExpanded(true)} data-testid="button-new-post">
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
        <button onClick={reset}>
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </div>

      <Textarea
        data-testid="input-post-content"
        autoFocus
        placeholder="What's on your mind? Type @guide: to attach a guide..."
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        rows={3}
        className="bg-secondary border-border resize-none"
      />

      {/* Guide search (shown when @guide: typed or button clicked) */}
      {showGuideSearch && (
        <div className="space-y-1">
          <GuideSearch onSelect={handleAttachGuide} />
          <button
            onClick={() => setShowGuideSearch(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel guide search
          </button>
        </div>
      )}

      {/* Attached guide preview */}
      {attachedGuide && (
        <div className="relative">
          <button
            onClick={handleDetachGuide}
            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition-colors"
            data-testid="button-detach-guide"
            title="Remove guide"
          >
            <X className="w-3 h-3" />
          </button>
          <GuideEmbedCard guide={attachedGuide} clickable={false} />
        </div>
      )}

      {/* Image uploader */}
      {showImages && !attachedVideo && (
        <ImageUploader value={imageIds} onChange={setImageIds} maxImages={4} label="Photos" />
      )}

      {/* Video uploader */}
      {showVideo && config.videoGroupEnabled && (
        <VideoUploader
          context="group"
          onUploaded={(result) => { setAttachedVideo(result); }}
          onRemove={() => { setAttachedVideo(null); setShowVideo(false); }}
          currentVideo={attachedVideo}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setShowImages(s => !s); if (showVideo) setShowVideo(false); }}
            className={`flex items-center gap-1.5 text-xs transition-colors ${showImages ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            data-testid="button-toggle-post-images"
            disabled={!!attachedVideo}
          >
            <ImageIcon className="w-4 h-4" />
            {showImages ? "Hide photos" : "Add photos"}
          </button>

          {config.videoGroupEnabled && (
            <button
              type="button"
              onClick={() => { setShowVideo(s => !s); setShowImages(false); }}
              className={`flex items-center gap-1.5 text-xs transition-colors ${showVideo || attachedVideo ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              data-testid="button-toggle-post-video"
              disabled={imageIds.length > 0}
            >
              <Video className="w-4 h-4" />
              {attachedVideo ? "Video attached" : showVideo ? "Cancel video" : "Add video"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGuideSearch(s => !s)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              showGuideSearch || attachedGuide
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
            data-testid="button-attach-guide"
          >
            <BookOpen className="w-4 h-4" />
            {attachedGuide ? "Change guide" : "Attach guide"}
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
          <Button
            size="sm"
            disabled={!canPost}
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

// ─── Related Guides sidebar panel ────────────────────────────
function RelatedGuides({ category }: { category?: string }) {
  const [, navigate] = useLocation();

  const { data: guides } = useQuery<any[]>({
    queryKey: ["/api/guides", { category }],
    queryFn: () => {
      const params = category ? `?category=${encodeURIComponent(category)}` : "";
      return apiRequest("GET", `/api/guides${params}`).then(r => r.json());
    },
    enabled: !!category,
  });

  // Fallback: fetch recent guides if no category match
  const { data: recentGuides } = useQuery<any[]>({
    queryKey: ["/api/guides", { recent: true }],
    queryFn: () => apiRequest("GET", "/api/guides").then(r => r.json()),
    enabled: !category || !guides?.length,
  });

  const displayed = (guides?.length ? guides : recentGuides)?.slice(0, 5) ?? [];

  if (!displayed.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-primary" />
          {category ? `${category} Guides` : "Recent Guides"}
        </h3>
        <button
          onClick={() => navigate("/guides")}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          All guides <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2">
        {displayed.map((guide: any) => (
          <Link key={guide.id} href={`/guides/${guide.id}`}>
            <div className="flex items-start gap-2.5 py-2 border-b border-border last:border-0 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                <BookOpen className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium line-clamp-1">{guide.title}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{guide.difficulty} · {guide.timeEstimate}h</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Group Rules Panel ─────────────────────────────────────
function GroupRulesPanel({ groupId }: { groupId: number }) {
  const { data: rules = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "rules"],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/rules`).then(r => r.json()),
  });

  if (!rules.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
        <Shield className="w-4 h-4 text-primary" /> Group Rules
      </h3>
      <ol className="space-y-2.5">
        {rules.map((rule: any, i: number) => (
          <li key={rule.id} className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug">{rule.title}</p>
              {rule.body && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{rule.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Group Search Panel ─────────────────────────────────────
function GroupSearchPanel({ groupId }: { groupId: number }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<"posts" | "members">("posts");

  const { data: postResults, isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "search", "posts", submitted],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/search/posts?q=${encodeURIComponent(submitted)}`).then(r => r.json()),
    enabled: submitted.length >= 2 && tab === "posts",
  });

  const { data: memberResults, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "search", "members", submitted],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/search/members?q=${encodeURIComponent(submitted)}`).then(r => r.json()),
    enabled: submitted.length >= 2 && tab === "members",
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(query.trim());
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
        <Search className="w-4 h-4 text-primary" />
        Search This Group
      </h3>

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            data-testid="input-group-search"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-secondary border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="Search posts or members..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          data-testid="button-group-search"
        >
          Go
        </button>
      </form>

      {/* Tab toggle */}
      <div className="flex bg-secondary rounded-lg p-0.5 mb-3">
        {(["posts", "members"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Results */}
      {submitted.length >= 2 && (
        <div className="space-y-1">
          {tab === "posts" && (
            postsLoading
              ? <div className="text-xs text-muted-foreground text-center py-3">Searching posts...</div>
              : !postResults?.length
              ? <div className="text-xs text-muted-foreground text-center py-3">No posts found</div>
              : postResults.map((p: any) => (
                <div key={p.id} className="p-2.5 rounded-lg hover:bg-secondary transition-colors text-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={p.author?.avatar} />
                      <AvatarFallback className="text-[8px]">{p.author?.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{p.author?.displayName}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(p.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.content}</p>
                </div>
              ))
          )}

          {tab === "members" && (
            membersLoading
              ? <div className="text-xs text-muted-foreground text-center py-3">Searching members...</div>
              : !memberResults?.length
              ? <div className="text-xs text-muted-foreground text-center py-3">No members found</div>
              : memberResults.map((u: any) => (
                <Link key={u.id} href={`/profile/${u.id}`}>
                  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={u.avatar} />
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">{u.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                    </div>
                    {u.role && u.role !== "member" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold capitalize">{u.role}</span>
                    )}
                  </div>
                </Link>
              ))
          )}
        </div>
      )}

      {!submitted && (
        <p className="text-xs text-muted-foreground text-center py-2">Type to search posts or find members</p>
      )}
    </div>
  );
}

// ─── Join Requests Panel (owner only) ────────────────────────────
// ─── Join Request Form (with membership questions) ────────────
function JoinRequestForm({ groupId, groupName, onSubmit, onCancel, isPending }: {
  groupId: number;
  groupName: string;
  onSubmit: (message: string, answers: any[]) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const { data: questions = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "questions"],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/questions`).then(r => r.json()),
  });

  const handleSubmit = () => {
    const answersArr = questions.map((q: any) => ({
      questionId: q.id,
      question: q.question,
      answer: answers[q.id] || "",
    }));
    onSubmit(message.trim(), answersArr);
  };

  const allRequiredAnswered = questions
    .filter((q: any) => q.required)
    .every((q: any) => answers[q.id]?.trim());

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 mb-5 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary" /> Request to Join {groupName}
      </h3>
      <p className="text-sm text-muted-foreground">
        This is a private group. The owner will review your request.
        {questions.length > 0 && " Please answer the questions below."}
      </p>

      {/* Membership questions */}
      {questions.map((q: any) => (
        <div key={q.id} className="space-y-1.5">
          <label className="text-xs font-medium">
            {q.question}
            {q.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <textarea
            className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm resize-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            rows={2}
            placeholder="Your answer..."
            value={answers[q.id] || ""}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
          />
        </div>
      ))}

      {/* Optional intro message */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Intro message <span className="font-normal">(optional)</span>
        </label>
        <textarea
          data-testid="textarea-join-message"
          className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm resize-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          rows={2}
          placeholder="Introduce yourself to the group owner..."
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !allRequiredAnswered}
          data-testid="button-submit-join-request"
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Send Request
        </Button>
      </div>
    </div>
  );
}

function RiskBadge({ score, flags }: { score: number; flags: string[] }) {
  if (score === 0) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">Low risk</span>;
  if (score < 20) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-semibold">Moderate</span>;
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold" title={flags.join(", ")}>High risk</span>;
}

function JoinRequestsPanel({ groupId }: { groupId: number }) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: requests = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "join-requests"],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/join-requests`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("POST", `/api/groups/${groupId}/join-requests/${userId}/approve`).then(r => r.json()),
    onSuccess: () => { toast({ title: "Request approved" }); refetch(); queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] }); },
  });

  const denyMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("POST", `/api/groups/${groupId}/join-requests/${userId}/deny`).then(r => r.json()),
    onSuccess: () => { toast({ title: "Request denied" }); refetch(); },
  });

  if (isLoading) return null;
  if (!requests.length) return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-2">
        <UserPlus className="w-4 h-4 text-primary" /> Join Requests
      </h3>
      <p className="text-xs text-muted-foreground">No pending requests</p>
    </div>
  );

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
        <UserPlus className="w-4 h-4 text-primary" />
        Join Requests
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{requests.length}</span>
      </h3>
      <div className="space-y-2">
        {requests.map((req: any) => {
          const isExpanded = expandedId === req.id;
          const answers: any[] = req.answers || [];
          const riskFlags: string[] = req.riskFlags || [];
          const accountAgeDays = req.user?.createdAt
            ? Math.floor((Date.now() - new Date(req.user.createdAt).getTime()) / 86400000)
            : null;
          return (
            <div key={req.id} className="bg-secondary rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-2.5">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={req.user?.avatar} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {req.user?.displayName?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold truncate">{req.user?.displayName || req.user?.username}</p>
                    <RiskBadge score={req.riskScore || 0} flags={riskFlags} />
                    {req.user?.phoneVerified && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">📱 Verified</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    @{req.user?.username}
                    {accountAgeDays !== null && <> · account {accountAgeDays < 1 ? "<1 day" : `${accountAgeDays}d`} old</>}
                    {req.user?.location && <> · {req.user.location}</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 items-center">
                  {(answers.length > 0 || req.message) && (
                    <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-6 h-6 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors text-xs"
                      title="View details">{isExpanded ? "−" : "+"}</button>
                  )}
                  <button onClick={() => approveMutation.mutate(req.userId)} disabled={approveMutation.isPending}
                    className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                    title="Approve" data-testid={`button-approve-${req.userId}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => denyMutation.mutate(req.userId)} disabled={denyMutation.isPending}
                    className="w-7 h-7 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                    title="Deny" data-testid={`button-deny-${req.userId}`}>
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  {riskFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {riskFlags.map(f => (
                        <span key={f} className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{f.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                  )}
                  {req.message && <div><p className="text-[10px] text-muted-foreground font-medium mb-0.5">Intro message:</p><p className="text-xs italic">"{req.message}"</p></div>}
                  {answers.map((a: any, i: number) => (
                    <div key={i}><p className="text-[10px] text-muted-foreground font-medium mb-0.5">Q: {a.question}</p><p className="text-xs">{a.answer || <span className="text-muted-foreground/60 italic">No answer</span>}</p></div>
                  ))}
                  {req.user?.bio && <div><p className="text-[10px] text-muted-foreground font-medium mb-0.5">Bio:</p><p className="text-xs text-muted-foreground">{req.user.bio}</p></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Events Panel ──────────────────────────────────────
// ─── Group Guides Panel ───────────────────────────────────────
function GroupGuidesPanel({ groupId, isGroupAdmin, currentUserId }: {
  groupId: number; isGroupAdmin: boolean; currentUserId?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: guides, isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "guides"],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/guides`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (guideId: number) =>
      apiRequest("POST", `/api/groups/${groupId}/guides`, { guideId }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "guides"] });
      toast({ title: "Guide added to group!" });
      setAddDialogOpen(false);
    },
    onError: () => toast({ title: "Error adding guide", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (guideId: number) =>
      apiRequest("DELETE", `/api/groups/${groupId}/guides/${guideId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "guides"] });
      toast({ title: "Guide removed from group" });
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{guides?.length ?? 0} guide{(guides?.length ?? 0) !== 1 ? "s" : ""} in this group</p>
        {isGroupAdmin && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5" data-testid="button-add-guide-to-group">
            <Plus className="w-3.5 h-3.5" /> Add Guide
          </Button>
        )}
      </div>

      {/* Guide list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !guides || guides.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No guides yet</p>
          <p className="text-sm mt-1">Add a guide to share knowledge with the group.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guides.map((guide: any) => (
            <div key={guide.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3" data-testid={`group-guide-${guide.id}`}>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/guides/${guide.id}`}>
                  <p className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">{guide.title}</p>
                </Link>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {guide.vertical && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{guide.vertical}</span>
                  )}
                  {guide.qualityScore > 0 && (
                    <span className="text-[10px] font-semibold text-primary">Score: {guide.qualityScore}</span>
                  )}
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Eye className="w-2.5 h-2.5" />{guide.views}</span>
                </div>
                {guide.author && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={guide.author.avatar ?? undefined} />
                      <AvatarFallback className="text-[8px]">{guide.author.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground">{guide.author.displayName ?? guide.author.username}</span>
                  </div>
                )}
              </div>
              {isGroupAdmin && (
                <Button size="sm" variant="ghost" onClick={() => removeMutation.mutate(guide.id)}
                  disabled={removeMutation.isPending}
                  data-testid={`button-remove-group-guide-${guide.id}`}
                  className="shrink-0 text-destructive hover:text-destructive h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add guide dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Add Guide to Group</DialogTitle>
            <DialogDescription>Search for a guide to share with this group.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <GuideSearch onSelect={(guide) => addMutation.mutate(guide.id)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupEventsPanel({ groupId, isGroupAdmin, groupVertical }: { groupId: number; isGroupAdmin: boolean; groupVertical?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [description, setDescription] = useState("");

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/community/events", groupId],
    queryFn: () => apiRequest("GET", `/api/community/events?group_id=${groupId}`).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/events", {
      title, description, group_id: groupId,
      vertical: groupVertical?.toLowerCase() || "general",
      event_date: eventDate || undefined,
      location_name: locationName, city, state: stateField,
      is_online: isOnline,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community/events", groupId] });
      toast({ title: "Event created" });
      setCreateOpen(false);
      setTitle(""); setEventDate(""); setLocationName(""); setCity(""); setStateField(""); setDescription("");
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const rsvpMut = useMutation({
    mutationFn: ({ eventId, status }: { eventId: number; status: string }) =>
      apiRequest("POST", `/api/community/events/${eventId}/rsvp`, { status }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/community/events", groupId] }),
  });

  return (
    <div>
      {isGroupAdmin && (
        <div className="mb-4">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5" data-testid="btn-create-group-event">
            <Plus className="w-4 h-4" /> Create Event for this Group
          </Button>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (events as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No events yet</p>
          {isGroupAdmin && <p className="text-sm">Create your first group event above</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {(events as any[]).map((ev: any) => (
            <div key={ev.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
              data-testid={`group-event-${ev.id}`}>
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ev.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {ev.event_date && <span>{new Date(ev.event_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                  {(ev.city || ev.state) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[ev.city, ev.state].filter(Boolean).join(", ")}</span>}
                  {ev.is_online && <span>Online</span>}
                  <span><Users className="w-3 h-3 inline mr-0.5" />{ev.rsvp_count || 0} going</span>
                </div>
                {ev.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>}
                {user && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {["going", "maybe", "not_going"].map(s => (
                      <button key={s} onClick={() => rsvpMut.mutate({ eventId: ev.id, status: s })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ev.my_rsvp === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/40"}`}>
                        {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't go"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Event for Group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title *</label>
              <input className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date & Time</label>
              <input type="datetime-local" className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <input className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">State</label>
                <input className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary" value={stateField} onChange={e => setStateField(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMut.isPending}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!title.trim() || createMut.isPending} data-testid="btn-confirm-create-group-event">
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── GroupDetailPage ──────────────────────────────────────────
export default function GroupDetailPage({ id }: { id: number }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [requestMessage, setRequestMessage] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery<any>({
    queryKey: ["/api/groups", id],
    queryFn: () => apiRequest("GET", `/api/groups/${id}`).then(r => r.json()),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "posts"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/posts`).then(r => r.json()),
    // For private groups, only fetch if member
  });

  const { data: membershipData } = useQuery<{ isMember: boolean; role: string | null; isSuperAdmin: boolean }>({
    queryKey: ["/api/groups", id, "membership"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/membership`).then(r => r.json()),
    enabled: isAuthenticated,
  });
  const isMember = membershipData?.isMember ?? false;
  const myRole = membershipData?.role ?? null;
  const isSiteAdmin = membershipData?.isSuperAdmin ?? false;
  const isOwner = user && group && user.id === group.ownerId;
  const isGroupAdmin = isOwner || myRole === "admin" || isSiteAdmin;

  // Settings sheet + delete dialog state
  const [mainTab, setMainTab] = useState<"posts" | "events" | "guides">("posts");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/groups/${id}`, { confirmName: deleteConfirmText });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Group deleted", description: "The group has been permanently deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      navigate("/groups");
    },
    onError: (err: any) => {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    },
  });

  // Join request status (for private groups)
  const { data: requestData, refetch: refetchRequest } = useQuery<{ status: string }>({
    queryKey: ["/api/groups", id, "join-request"],
    queryFn: () => apiRequest("GET", `/api/groups/${id}/join-request`).then(r => r.json()),
    enabled: isAuthenticated && !isMember && !!group?.private,
  });
  const requestStatus = requestData?.status ?? 'none';

  const joinMutation = useMutation({
    mutationFn: (payload?: string | { message?: string; answers?: any[] }) => {
      const body = typeof payload === "string" ? { message: payload } : (payload || {});
      return apiRequest("POST", `/api/groups/${id}/join`, body).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.requested) {
        toast({ title: "Request sent!", description: "The group owner will review your request." });
        refetchRequest();
        setShowRequestForm(false);
      } else {
        toast({ title: "Joined group!" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id] });
    },
    onError: () => toast({ title: "Error", description: "Could not join. Try again.", variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/leave`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Left group" });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id] });
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/groups/${id}/join-request`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Request cancelled" });
      refetchRequest();
    },
  });

  const handleJoinClick = () => {
    if (!isAuthenticated) { toast({ title: "Sign in required" }); return; }
    if (isMember) { leaveMutation.mutate(); return; }
    if (group?.private) {
      setShowRequestForm(true);
    } else {
      joinMutation.mutate();
    }
  };

  const handleSubmitRequest = () => {
    joinMutation.mutate(requestMessage.trim() || undefined);
  };

  if (groupLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-48 rounded-xl mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!group) return <div className="p-8 text-center text-muted-foreground">Group not found.</div>;

  // Private group: non-members can see name/description but NOT posts
  const canSeePosts = !group.private || isMember || isOwner;
  const isPending = requestStatus === 'pending';
  const isDenied = requestStatus === 'denied';

  // Join button label
  const joinLabel = () => {
    if (joinMutation.isPending || leaveMutation.isPending) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (isMember) return "Leave Group";
    if (isPending) return <><Clock className="w-3.5 h-3.5" /> Request Pending</>;
    if (group.private) return <><Lock className="w-3.5 h-3.5" /> Request to Join</>;
    return "Join Group";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Cover + header */}
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-5">
        <div className="relative h-48 bg-secondary">
          {group.coverImage ? (
            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🏁</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          {/* Private badge on cover */}
          {group.private && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full border border-border">
              <Lock className="w-3 h-3" /> Private Group
            </div>
          )}
        </div>
        <div className="px-5 pb-5 -mt-6 relative">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-display text-2xl font-extrabold text-foreground mb-1">{group.name}</h1>
              <p className="text-muted-foreground text-sm mb-2">{group.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{(group.memberCount || 0).toLocaleString()} members</span>
                {canSeePosts && <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{(group.postCount || 0).toLocaleString()} posts</span>}
                <Badge className="text-xs">{group.category}</Badge>
                {group.private && <span className="flex items-center gap-1 text-amber-400"><Lock className="w-3 h-3" /> Private</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Main action button */}
              {!isPending && (
                <Button
                  data-testid="button-join-group"
                  onClick={handleJoinClick}
                  disabled={joinMutation.isPending || leaveMutation.isPending}
                  variant={isMember ? "outline" : "default"}
                  className="shrink-0 gap-1.5"
                >
                  {joinLabel()}
                </Button>
              )}
              {/* Pending state */}
              {isPending && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-amber-400 font-medium">
                    <Clock className="w-4 h-4" /> Request Pending
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelRequestMutation.mutate()}
                    disabled={cancelRequestMutation.isPending}
                    className="text-muted-foreground hover:text-destructive text-xs"
                    data-testid="button-cancel-request"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {/* Denied state */}
              {isDenied && !isMember && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Request not approved
                </p>
              )}
              {/* Role badge + settings gear for members/admins/owner */}
              {(isMember || isGroupAdmin) && (
                <div className="flex items-center gap-2 mt-1">
                  {myRole && myRole !== "member" && (
                    <span className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                      <Crown className="w-3 h-3" />
                      {isOwner ? "Owner" : myRole === "admin" ? "Admin" : "Moderator"}
                    </span>
                  )}
                  <Button
                    data-testid="btn-group-settings"
                    variant="outline"
                    size="sm"
                    onClick={() => setSettingsOpen(true)}
                    className="gap-1.5 text-xs border-border"
                  >
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Request to join form (private groups) */}
      {showRequestForm && group.private && !isMember && (
        <JoinRequestForm
          groupId={id}
          groupName={group.name}
          onSubmit={(message, answers) => joinMutation.mutate({ message, answers } as any)}
          onCancel={() => setShowRequestForm(false)}
          isPending={joinMutation.isPending}
        />
      )}

      {/* Two-column layout: feed + sidebar */}
      <div className="flex gap-5 items-start">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Post composer — only for members */}
          {isMember && user && <PostComposer groupId={id} user={user} />}

          {/* Private group locked state for non-members */}
          {!canSeePosts && (
            <div className="bg-card border border-border rounded-xl p-10 text-center mb-5">
              <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold text-foreground mb-1">This is a private group</p>
              <p className="text-sm text-muted-foreground mb-5">
                Only members can see posts and discussions.
              </p>
              {isAuthenticated && !isPending && (
                <Button onClick={handleJoinClick} className="gap-1.5">
                  <UserPlus className="w-4 h-4" /> Request to Join
                </Button>
              )}
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground">Sign in to request membership</p>
              )}
              {isPending && (
                <p className="text-sm text-amber-400 flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4" /> Your request is pending approval
                </p>
              )}
            </div>
          )}

          {/* Non-member nudge for public groups */}
          {canSeePosts && !isMember && isAuthenticated && !group.private && (
            <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 mb-5 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Join this group to post and share guides with members.</p>
              <Button size="sm" onClick={handleJoinClick} disabled={joinMutation.isPending} className="shrink-0">
                Join Group
              </Button>
            </div>
          )}

          {/* Tab bar: Posts | Events */}
          {canSeePosts && (
            <div className="flex items-center gap-1 mb-4 border-b border-border">
              {(["posts", "events", "guides"] as const).map(t => (
                <button key={t} onClick={() => setMainTab(t)}
                  data-testid={`group-tab-${t}`}
                  className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${mainTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t === "posts" ? <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Posts</span>
                    : t === "events" ? <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Events</span>
                    : <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />Guides</span>}
                </button>
              ))}
            </div>
          )}

          {/* Posts feed */}
          {canSeePosts && mainTab === "posts" && (
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
                  <p className="text-sm mt-1">{isMember ? "Be the first to post — try attaching a guide!" : "Join to start posting."}</p>
                </div>
              ) : (
                posts.map(post => <PostCard key={post.id} post={post} currentUserId={user?.id} groupAdminRole={myRole} />)
              )}
            </div>
          )}

          {/* Events tab */}
          {canSeePosts && mainTab === "events" && (
            <GroupEventsPanel groupId={id} isGroupAdmin={!!isGroupAdmin} groupVertical={group?.category} />
          )}

          {/* Guides tab */}
          {canSeePosts && mainTab === "guides" && (
            <GroupGuidesPanel groupId={id} isGroupAdmin={!!isGroupAdmin} currentUserId={user?.id} />
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-20">
          {/* Join requests panel — owner only */}
          {isOwner && group.private && <JoinRequestsPanel groupId={id} />}
          <GroupRulesPanel groupId={id} />
          <GroupSearchPanel groupId={id} />
          <RelatedGuides category={group.category} />
        </div>
      </div>

      {/* ── Group Settings Sheet ── */}
      {settingsOpen && group && (
        <GroupSettingsSheet
          group={group}
          isOwner={!!isOwner}
          isSiteAdmin={isSiteAdmin}
          onClose={() => setSettingsOpen(false)}
          onDeleteRequest={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
        />
      )}

      {/* ── Delete Group Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Delete Group
            </DialogTitle>
            <DialogDescription>
              This is permanent and cannot be undone. All posts, members, and content in this group will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Failsafes active:</p>
              <ul className="text-xs space-y-0.5 ml-5 list-disc text-destructive/80">
                <li>Only the group owner or a site administrator can delete</li>
                <li>Must confirm by typing the group name exactly</li>
                <li>Deletion is logged to the admin audit trail</li>
                <li>Group admins/moderators cannot delete — owner only</li>
              </ul>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Type <span className="font-mono font-bold text-foreground">{group.name}</span> to confirm:
              </p>
              <Input
                data-testid="input-delete-confirm"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={group.name}
                className="font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                data-testid="btn-confirm-delete-group"
                variant="destructive"
                disabled={deleteConfirmText.trim().toLowerCase() !== group.name.toLowerCase() || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="gap-1.5"
              >
                {deleteMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                  : <><Trash2 className="w-4 h-4" /> Permanently Delete</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
