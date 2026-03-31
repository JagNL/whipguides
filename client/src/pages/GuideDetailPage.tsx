import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, Eye, Clock, Wrench, Package, ChevronLeft, BookOpen,
  Trash2, MessageSquare, Send, CheckCircle2, Share2, Users, Pencil,
  ScanLine, ChevronRight, Circle, DollarSign, BarChart2,
  ThumbsUp, ShieldCheck, Instagram, ExternalLink,
} from "lucide-react";
import { useCfUrl } from "@/hooks/use-cf-url";
import { AnnotatedImage, TorqueSpecsTable, HardwareList } from "@/components/GuideAnnotations";
import type { Annotation } from "@/components/GuideAnnotations";
import { PartsIntelligence } from "@/components/PartsIntelligence";
import type { Guide, GuideComment } from "@/../../server/storage";
import { extractYouTubeId } from "@/lib/guide-verticals";
import { GUIDE_VERTICALS } from "@/lib/guide-verticals";
import { VERTICAL_ICONS } from "@/components/CreateGuideSteps";
import { guideUrl, profileUrl } from "@/lib/utils";

function difficultyColor(d: string) {
  if (d === "beginner") return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
  if (d === "intermediate") return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
  return "bg-red-500/15 text-red-400 border border-red-500/20";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Embed renderer ────────────────────────────────────────────
function EmbedRenderer({ url, embedType }: { url?: string; embedType?: string }) {
  if (!url) return null;
  const ytId = extractYouTubeId(url);
  if (embedType === "youtube" || ytId) {
    const vid = ytId ?? extractYouTubeId(url);
    if (!vid) return null;
    return (
      <div className="mb-6 rounded-xl overflow-hidden border border-border">
        <iframe
          src={`https://www.youtube.com/embed/${vid}`}
          className="w-full aspect-video"
          allowFullScreen
          title="Guide video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    );
  }
  if (embedType === "instagram" || /instagram\.com\/p\//.test(url)) {
    return (
      <div className="mb-6 bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <Instagram className="w-6 h-6 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Instagram Post</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
            <ExternalLink className="w-3.5 h-3.5" /> View on Instagram
          </Button>
        </a>
      </div>
    );
  }
  return null;
}

// ─── Series navigation ─────────────────────────────────────────
function SeriesNav({ seriesId, currentGuideId }: { seriesId: number; currentGuideId: number }) {
  const { data: series } = useQuery<any>({
    queryKey: ["/api/guide-series", seriesId],
    queryFn: () => apiRequest("GET", `/api/guide-series/${seriesId}`).then(r => r.json()),
  });
  if (!series) return null;
  const guides: any[] = series.guides ?? [];
  const currentIdx = guides.findIndex((g: any) => g.id === currentGuideId);
  const prevGuide = currentIdx > 0 ? guides[currentIdx - 1] : null;
  const nextGuide = currentIdx < guides.length - 1 ? guides[currentIdx + 1] : null;
  const part = currentIdx + 1;
  const total = guides.length;

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Part {part} of {total}</p>
          <p className="font-semibold text-sm">{series.title}</p>
        </div>
        <Link href={`/guide-series/${seriesId}`}>
          <Button size="sm" variant="outline" className="text-xs shrink-0">View Full Series</Button>
        </Link>
      </div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-3">
        {guides.map((_: any, i: number) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i < currentIdx ? "w-2.5 h-2.5 bg-primary" :
              i === currentIdx ? "w-3 h-3 bg-primary ring-2 ring-primary/30" :
              "w-2.5 h-2.5 bg-border"
            }`}
          />
        ))}
      </div>
      {/* Prev/Next */}
      <div className="flex items-center justify-between gap-2">
        {prevGuide ? (
          <Link href={guideUrl(prevGuide.id, prevGuide.title)} className="flex-1">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-start">
              <ChevronLeft className="w-3.5 h-3.5" /> {prevGuide.title}
            </Button>
          </Link>
        ) : <div />}
        {nextGuide ? (
          <Link href={guideUrl(nextGuide.id, nextGuide.title)} className="flex-1">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-end">
              {nextGuide.title} <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}

// ─── Share to Group modal ────────────────────────────────────
function ShareToGroupModal({ guide, open, onClose, onShare }: { guide: Guide; open: boolean; onClose: () => void; onShare?: () => void }) {
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [message, setMessage] = useState("");

  const { data: groups } = useQuery<any[]>({
    queryKey: ["/api/groups"],
    queryFn: () => apiRequest("GET", "/api/groups").then(r => r.json()),
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/groups/${selectedGroupId}/posts`, {
        content: message.trim() || `Check out this guide: ${guide.title}`,
        images: [],
        guideId: guide.id,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Shared to group!", description: "Your post is live." });
      setMessage(""); setSelectedGroupId("");
      onShare?.();
      onClose();
    },
    onError: () => toast({ title: "Error sharing", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" /> Share Guide to a Group
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-secondary rounded-lg p-3 text-sm">
            <p className="font-semibold line-clamp-1">{guide.title}</p>
            <p className="text-muted-foreground text-xs mt-0.5 capitalize">{guide.difficulty}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Post to group</label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger data-testid="select-share-group" className="bg-secondary">
                <SelectValue placeholder="Pick a group..." />
              </SelectTrigger>
              <SelectContent>
                {groups?.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />{g.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Add a message <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea data-testid="textarea-share-message" placeholder="Say something about this guide..."
              value={message} onChange={e => setMessage(e.target.value)} className="bg-secondary resize-none min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => shareMutation.mutate()} disabled={!selectedGroupId || shareMutation.isPending}
            data-testid="button-confirm-share-guide" className="gap-2">
            {shareMutation.isPending ? "Sharing..." : <><Share2 className="w-4 h-4" /> Share to Group</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Revenue section (author only, collapsed) ─────────────────
function RevenueSection({ guideId }: { guideId: number }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<any[]>({
    queryKey: ["/api/guides", guideId, "revenue"],
    queryFn: () => apiRequest("GET", `/api/guides/${guideId}/revenue`).then(r => r.json()),
    enabled: open,
  });
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-secondary/50 transition-colors"
        data-testid="button-toggle-revenue"
      >
        <span className="flex items-center gap-2 font-semibold"><DollarSign className="w-4 h-4 text-primary" />Revenue Attribution</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          {!data ? (
            <Skeleton className="h-20 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No revenue data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2">Month</th><th className="text-right py-2">Clicks</th>
                    <th className="text-right py-2">Revenue</th><th className="text-right py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{row.month}</td>
                      <td className="py-2 text-right">{row.clickCount ?? "—"}</td>
                      <td className="py-2 text-right text-primary font-semibold">${((row.payoutCents ?? 0) / 100).toFixed(2)}</td>
                      <td className="py-2 text-right capitalize text-muted-foreground">{row.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────
export default function GuideDetailPage({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cfUrl = useCfUrl();
  const signalSentRef = useRef(false);

  const [commentText, setCommentText] = useState("");
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikes, setOptimisticLikes] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [helpedOptimistic, setHelpedOptimistic] = useState(false);

  const toggleStep = (i: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
    // Fire step_complete signal
    apiRequest("POST", `/api/guides/${id}/signal`, { signalType: "step_complete" }).catch(() => {});
  };

  const { data: guide, isLoading } = useQuery<Guide>({
    queryKey: ["/api/guides", id],
    queryFn: () => apiRequest("GET", `/api/guides/${id}`).then(r => r.json()),
  });

    // SEO — updates whenever guide loads
  useSEO({
    title: guide ? (guide as any).title : "Guide",
    description: guide ? (guide as any).description?.slice(0, 160) : undefined,
    image: guide ? ((guide as any).coverImage || (guide as any).coverImageId || null) : null,
    url: `${window.location.origin}${guideUrl(id, (guide as any)?.title)}`,
    type: "article",
  });

  const { data: comments } = useQuery<GuideComment[]>({
    queryKey: ["/api/guides", id, "comments"],
    queryFn: () => apiRequest("GET", `/api/guides/${id}/comments`).then(r => r.json()),
  });

  // 30-second return visit signal
  useEffect(() => {
    if (!guide || signalSentRef.current) return;
    const timer = setTimeout(() => {
      if (!signalSentRef.current) {
        signalSentRef.current = true;
        apiRequest("POST", `/api/guides/${id}/signal`, { signalType: "return_visit" }).catch(() => {});
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [guide, id]);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/guides/${id}/like`).then(r => r.json()),
    onMutate: () => {
      const current = guide?.isLiked ?? false;
      const currentLikes = guide?.likes ?? 0;
      setOptimisticLiked(!current);
      setOptimisticLikes(current ? Math.max(0, currentLikes - 1) : currentLikes + 1);
    },
    onSuccess: (data) => {
      setOptimisticLiked(data.liked);
      setOptimisticLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ["/api/guides", id] });
    },
    onError: () => { setOptimisticLiked(null); setOptimisticLikes(null); },
  });

  const helpedMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/guides/${id}/helped`).then(r => r.json()),
    onMutate: () => setHelpedOptimistic(true),
    onError: () => setHelpedOptimistic(false),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/guides/${id}/comments`, { content }).then(r => r.json()),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/guides", id, "comments"] });
      toast({ title: "Comment posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/guides/${id}`).then(r => r.json()),
    onSuccess: () => { toast({ title: "Guide deleted" }); navigate("/guides"); },
  });

  const isLiked = optimisticLiked !== null ? optimisticLiked : guide?.isLiked ?? false;
  const likeCount = optimisticLikes !== null ? optimisticLikes : guide?.likes ?? 0;
  const isAuthor = user && guide && user.id === guide.authorId;
  const g = guide as any;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Guide not found</p>
        <Button variant="ghost" onClick={() => navigate("/guides")} className="mt-4 gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Guides
        </Button>
      </div>
    );
  }

  // Handle both raw R2 imageId and full CDN URLs (legacy guides saved with full URL)
  const coverSrc = guide.coverImageId
    ? (guide.coverImageId.startsWith("http") ? guide.coverImageId : `${cfUrl}/${guide.coverImageId}/public`)
    : null;
  const verticalDef = g.vertical ? GUIDE_VERTICALS.find(v => v.key === g.vertical) : null;
  const VerticalIcon = verticalDef ? (VERTICAL_ICONS[verticalDef.icon] ?? Wrench) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate("/guides")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="button-back-guides">
        <ChevronLeft className="w-4 h-4" /> All Guides
      </button>

      {/* Series navigation */}
      {g.seriesId && <SeriesNav seriesId={g.seriesId} currentGuideId={guide.id} />}

      {/* Header embed (above cover) */}
      {g.headerEmbedUrl && <EmbedRenderer url={g.headerEmbedUrl} embedType={g.headerEmbedType} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${difficultyColor(guide.difficulty)}`}>
            {guide.difficulty}
          </span>
          {guide.category && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
              {guide.category}
            </span>
          )}
          {verticalDef && VerticalIcon && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
              <VerticalIcon className="w-3 h-3" /> {verticalDef.label}
            </span>
          )}
          {g.communityVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              title="This guide has been reviewed and verified by the WhipGuides community">
              <ShieldCheck className="w-3 h-3" /> Community Verified
            </span>
          )}
          {isAuthor && g.isMonetized && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
              <DollarSign className="w-3 h-3" /> Monetized
            </span>
          )}
          {isAuthor && g.qualityScore > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <BarChart2 className="w-3 h-3" /> Score: {g.qualityScore}
            </span>
          )}
        </div>

        <h1 className="text-display text-2xl font-extrabold tracking-tight leading-tight mb-3" data-testid="text-guide-title">
          {guide.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
          {guide.author && (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={guide.author.avatar ?? undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {guide.author.displayName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Link href={profileUrl(guide.authorId, (guide as any).authorName)} className="hover:text-foreground transition-colors">
                {guide.author.displayName ?? guide.author.username}
              </Link>
            </div>
          )}
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {guide.views} views</span>
          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {likeCount} likes</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {guide.timeEstimate} hours</span>
          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {guide.steps.length} steps</span>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {isAuthenticated && (
            <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}
              data-testid="button-share-guide" className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share to Group
            </Button>
          )}
          {isAuthor && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/guides/${guide.id}/edit`)}
                className="gap-1.5" data-testid="button-edit-guide">
                <Pencil className="w-3.5 h-3.5" /> Edit Guide
              </Button>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending} data-testid="button-delete-guide" className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Guide
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cover image */}
      {coverSrc && (
        <div className="mb-8 rounded-xl overflow-hidden border border-border">
          <img src={coverSrc} alt={guide.title} className="w-full max-h-80 object-cover" />
        </div>
      )}

      {/* Description */}
      <div className="mb-8 bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{guide.description}</p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Subject info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            {VerticalIcon ? <VerticalIcon className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-primary" />}
            <span className="font-semibold text-sm">{verticalDef?.label ?? "Subject"}</span>
          </div>
          {g.subjectData && Object.keys(g.subjectData).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(g.subjectData).filter(([, v]: any) => v && v !== "na").map(([k, v]: any) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{v}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium">{[g.vehicleYearStart, g.vehicleMake, g.vehicleModel].filter(Boolean).join(" ") || "—"}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Details</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Difficulty:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColor(guide.difficulty)}`}>{guide.difficulty}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Time estimate:</span>
              <span className="font-medium">{guide.timeEstimate} hours</span>
            </div>
          </div>
        </div>
        {guide.tools.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Tools Required</span>
            </div>
            <ul className="space-y-1.5">
              {guide.tools.map((tool, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {tool}
                </li>
              ))}
            </ul>
          </div>
        )}
        {guide.parts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Parts Required</span>
            </div>
            <ul className="space-y-2">
              {guide.parts.map((part, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{part.name}</span>
                    {part.price && <span className="text-muted-foreground text-xs">${part.price}</span>}
                  </div>
                  {part.link && <a href={part.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Buy Now →</a>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Steps */}
      {guide.steps.length > 0 && (<>
        <div className="mb-10">
          {guide.steps.length > 1 && (
            <div className="mb-5 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progress</span>
                <span className="text-xs text-muted-foreground">{completedSteps.size} / {guide.steps.length} steps</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(completedSteps.size / guide.steps.length) * 100}%` }} />
              </div>
              {completedSteps.size === guide.steps.length && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All steps complete!
                </p>
              )}
            </div>
          )}
          <h2 className="text-display text-lg font-extrabold mb-5 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Steps
          </h2>
          <div className="space-y-6">
            {guide.steps.map((step, idx) => {
              const isComplete = completedSteps.has(idx);
              const stepAnnotations = (step.annotations ?? []) as Annotation[];
              const stepEmbed = (step as any).embedUrl;
              return (
                <div key={idx}
                  className={`bg-card border rounded-xl p-6 transition-colors ${isComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}
                  data-testid={`card-step-${idx}`}>
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleStep(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 transition-all border-2 ${
                        isComplete ? "bg-emerald-500 border-emerald-500 text-white" : "bg-primary/15 border-primary text-primary hover:bg-primary hover:text-white"
                      }`}
                      title={isComplete ? "Mark incomplete" : "Mark complete"}
                      data-testid={`button-step-complete-${idx}`}>
                      {isComplete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm mb-2 ${isComplete ? "line-through text-muted-foreground" : ""}`}>{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mb-3">{step.description}</p>
                      {step.imageUrls && step.imageUrls.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          {step.imageUrls.map((url, imgIdx) => {
                            const resolvedUrl = url.startsWith("http") || url.startsWith("data:") ? url : `${cfUrl}/${url}/public`;
                            const hasAnn = stepAnnotations.some(a => a.imageUrl === resolvedUrl);
                            return hasAnn ? (
                              <AnnotatedImage key={imgIdx} imageUrl={resolvedUrl} annotations={stepAnnotations} stepIndex={idx} />
                            ) : (
                              <img key={imgIdx} src={resolvedUrl} alt={`Step ${idx + 1} image ${imgIdx + 1}`}
                                className="w-full rounded-xl border border-border object-cover max-h-64" />
                            );
                          })}
                        </div>
                      )}
                      {/* Per-step embed */}
                      {stepEmbed && (
                        <div className="mt-4">
                          <EmbedRenderer url={stepEmbed} />
                        </div>
                      )}
                      {stepAnnotations.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {stepAnnotations.map((ann, ai) => (
                            <span key={ai} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground flex items-center gap-1">
                              <span className="font-bold text-foreground">{ai + 1}</span> {ann.label}
                              {ann.torqueSpec && <span className="text-amber-400 font-semibold">{ann.torqueSpec}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {(step.tools?.length || 0) > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {step.tools!.map((t, ti) => (
                            <span key={ti} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              <Wrench className="w-3 h-3" /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {step.estimatedTime && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ~{step.estimatedTime}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <TorqueSpecsTable steps={guide.steps.map(s => ({ title: s.title, annotations: (s.annotations ?? []) as Annotation[] }))} />
        <HardwareList steps={guide.steps.map(s => ({ annotations: (s.annotations ?? []) as Annotation[] }))} />
      </>)}

      <PartsIntelligence guideId={guide.id} vertical={g.vertical} />

      {/* "This helped me" button */}
      <div className="flex flex-col sm:flex-row items-center gap-4 py-6 border-t border-b border-border mb-6">
        <Button
          variant={helpedOptimistic || helpedMutation.isSuccess ? "default" : "outline"}
          onClick={() => {
            if (!isAuthenticated) { toast({ title: "Sign in to mark guides as helpful" }); return; }
            if (!helpedOptimistic) helpedMutation.mutate();
          }}
          disabled={helpedOptimistic || helpedMutation.isPending}
          data-testid="button-guide-helped"
          className={`gap-2 ${helpedOptimistic ? "bg-emerald-600 hover:bg-emerald-600 border-emerald-600" : ""}`}
        >
          <ThumbsUp className={`w-4 h-4 ${helpedOptimistic ? "fill-current" : ""}`} />
          {helpedOptimistic ? "Marked as helpful!" : "This guide helped me!"}
        </Button>
        <Button
          variant={isLiked ? "default" : "outline"}
          onClick={() => {
            if (!isAuthenticated) { toast({ title: "Sign in to like guides" }); return; }
            likeMutation.mutate();
          }}
          disabled={likeMutation.isPending}
          data-testid="button-like-guide"
          className="gap-2"
        >
          <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
          {isLiked ? "Liked" : "Like"} · {likeCount}
        </Button>
      </div>

      {/* Revenue section (author + monetized only) */}
      {isAuthor && g.isMonetized && <RevenueSection guideId={guide.id} />}

      {/* Comments */}
      <div>
        <h2 className="text-display text-lg font-extrabold mb-5 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Comments
          {comments && <span className="text-muted-foreground font-normal text-sm">({comments.length})</span>}
        </h2>
        {isAuthenticated ? (
          <div className="flex gap-3 mb-6">
            <Avatar className="w-8 h-8 shrink-0 mt-1">
              <AvatarImage src={user?.avatar ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary">{user?.displayName?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea data-testid="textarea-comment" placeholder="Share a tip, question, or feedback..."
                value={commentText} onChange={e => setCommentText(e.target.value)}
                className="bg-secondary resize-none min-h-[80px]" />
              <Button size="sm" onClick={() => commentText.trim() && commentMutation.mutate(commentText)}
                disabled={!commentText.trim() || commentMutation.isPending} data-testid="button-post-comment" className="gap-1.5">
                <Send className="w-3.5 h-3.5" /> Post Comment
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-muted-foreground">
              <button className="text-primary hover:underline" onClick={() => navigate("/")}>Sign in</button> to leave a comment
            </p>
          </div>
        )}
        <div className="space-y-4">
          {comments?.length === 0 && <p className="text-sm text-muted-foreground py-4">No comments yet. Be the first!</p>}
          {comments?.map(comment => (
            <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
              <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                <AvatarImage src={comment.author?.avatar ?? undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {comment.author?.displayName?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-card border border-border rounded-xl p-3">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold">{comment.author?.displayName ?? comment.author?.username ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground/90">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {guide && (
        <ShareToGroupModal
          guide={guide}
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          onShare={() => apiRequest("POST", `/api/guides/${id}/signal`, { signalType: "share" }).catch(() => {})}
        />
      )}
    </div>
  );
}
