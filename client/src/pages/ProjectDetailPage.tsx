import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import { useAppConfig } from "@/hooks/use-cf-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PostImageGrid } from "@/components/ImageLightbox";
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  Heart, BookOpen, Eye, UserPlus, Plus, Loader2, Trash2, Wrench,
  DollarSign, Gauge, Package, Link as LinkIcon,
} from "lucide-react";
import { Link } from "wouter";
import { timeAgo } from "@/lib/utils";

const VERTICAL_LABELS: Record<string, string> = {
  automotive: "Automotive", tech: "Tech", music: "Music", firearms: "Firearms",
  maker: "Maker", powersports: "Powersports", general: "General",
};

function VerticalBadge({ v }: { v: string }) {
  const colors: Record<string, string> = {
    automotive: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    tech: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    music: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    firearms: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    maker: "bg-green-500/15 text-green-400 border-green-500/30",
    powersports: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    general: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colors[v] || colors.general}`}>
      {VERTICAL_LABELS[v] || v}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    complete: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    abandoned: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${map[status] || map.active}`}>{status}</span>;
}

// ── Parts List ────────────────────────────────────────────────
interface Part { name: string; brand?: string; link?: string; cost?: string }

function PartsList({ parts }: { parts: Part[] }) {
  if (!parts?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5" /> Parts Used
      </p>
      <div className="space-y-1.5">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{p.name}</span>
            {p.brand && <span className="text-muted-foreground">{p.brand}</span>}
            {p.cost && <span className="text-primary font-medium">${p.cost}</span>}
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-0.5">
                <LinkIcon className="w-3 h-3" /> Link
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Post Update Form ──────────────────────────────────────────
function PostUpdateForm({ projectId, cfBase, videoEnabled }: { projectId: number; cfBase: string; videoEnabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mileage, setMileage] = useState("");
  const [cost, setCost] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [open, setOpen] = useState(false);

  const addPart = () => setParts(p => [...p, { name: "", brand: "", link: "", cost: "" }]);
  const updatePart = (i: number, field: keyof Part, val: string) =>
    setParts(p => p.map((pt, idx) => idx === i ? { ...pt, [field]: val } : pt));
  const removePart = (i: number) => setParts(p => p.filter((_, idx) => idx !== i));

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/projects/${projectId}/updates`, {
      content, mileage: mileage ? Number(mileage) : undefined,
      cost: cost ? Number(cost) : undefined,
      parts_used: parts.filter(p => p.name.trim()),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community/projects", projectId, "updates"] });
      qc.invalidateQueries({ queryKey: ["/api/community/projects", projectId] });
      setContent(""); setMileage(""); setCost(""); setParts([]); setOpen(false);
      toast({ title: "Update posted" });
    },
    onError: () => toast({ title: "Error posting update", variant: "destructive" }),
  });

  if (!open) return (
    <Button onClick={() => setOpen(true)} className="gap-1.5" data-testid="btn-post-update">
      <Plus className="w-4 h-4" /> Post Update
    </Button>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-sm">New Update</h3>
      <Textarea placeholder="What did you work on?" value={content} onChange={e => setContent(e.target.value)}
        rows={4} className="resize-none" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> Mileage</label>
          <Input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="e.g. 45000" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Cost</label>
          <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      {/* Parts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium">Parts Used</p>
          <button onClick={addPart} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add part
          </button>
        </div>
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 mb-2">
            <Input placeholder="Name" value={p.name} onChange={e => updatePart(i, "name", e.target.value)} className="col-span-1" />
            <Input placeholder="Brand" value={p.brand || ""} onChange={e => updatePart(i, "brand", e.target.value)} className="col-span-1" />
            <Input placeholder="$cost" value={p.cost || ""} onChange={e => updatePart(i, "cost", e.target.value)} className="col-span-1" />
            <button onClick={() => removePart(i)} className="text-destructive hover:text-destructive/80 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} disabled={mut.isPending}>Cancel</Button>
        <Button onClick={() => mut.mutate()} disabled={!content.trim() || mut.isPending} data-testid="btn-submit-update">
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Update"}
        </Button>
      </div>
    </div>
  );
}

// ── Update Card ───────────────────────────────────────────────
function UpdateCard({ update, isOwner, projectId, cfBase }: { update: any; isOwner: boolean; projectId: number; cfBase: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const images: string[] = (update.images || []).map((id: string) =>
    id.startsWith("http") || id.startsWith("data:") ? id : cfBase ? `${cfBase}/${id}/public` : id
  );

  const deleteMut = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/community/projects/${projectId}/updates/${update.id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/community/projects", projectId, "updates"] }); toast({ title: "Deleted" }); },
  });

  return (
    <div className="border-l-2 border-primary/30 pl-4 pb-6 relative" data-testid={`update-${update.id}`}>
      <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-primary/60 border-2 border-background" />
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{timeAgo(update.created_at)}</span>
          {isOwner && (
            <button onClick={() => deleteMut.mutate()} className="text-destructive hover:text-destructive/80 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{update.content}</p>
        {images.length > 0 && <div className="mt-3"><PostImageGrid images={images} /></div>}
        {update.video_hls_url && (
          <div className="mt-3"><VideoPlayer src={update.video_hls_url} poster={update.video_thumbnail_url} /></div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {update.mileage != null && <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" />{update.mileage.toLocaleString()} mi</span>}
          {update.cost != null && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />${Number(update.cost).toLocaleString()}</span>}
        </div>
        <PartsList parts={update.parts_used || []} />
      </div>
    </div>
  );
}

// ── Main ProjectDetailPage ────────────────────────────────────
export default function ProjectDetailPage({ id }: { id: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const cfBase = useCfUrl();
  const qc = useQueryClient();
  const { videoEnabled } = useAppConfig();

  const { data: project, isLoading: projLoading } = useQuery<any>({
    queryKey: ["/api/community/projects", id],
    queryFn: () => apiRequest("GET", `/api/community/projects/${id}`).then(r => r.json()),
  });
  const { data: updates = [], isLoading: updatesLoading } = useQuery<any[]>({
    queryKey: ["/api/community/projects", id, "updates"],
    queryFn: () => apiRequest("GET", `/api/community/projects/${id}/updates`).then(r => r.json()),
  });

  const likeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/projects/${id}/like`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/community/projects", id] }),
    onError: () => toast({ title: !user ? "Sign in to like" : "Error", variant: "destructive" }),
  });

  const followMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/projects/${id}/follow`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/community/projects", id] }); toast({ title: "Following project" }); },
    onError: () => toast({ title: !user ? "Sign in to follow" : "Error", variant: "destructive" }),
  });

  if (projLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );

  if (!project) return (
    <div className="text-center py-20 text-muted-foreground">
      <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p>Project not found</p>
    </div>
  );

  const isOwner = user?.id === project.owner_id;
  const coverSrc = project.cover_image ? cfImageUrl(cfBase, project.cover_image) : null;
  const gradient = {
    automotive: "from-blue-900/60 to-background",
    tech: "from-cyan-900/60 to-background",
    music: "from-purple-900/60 to-background",
    general: "from-slate-900/60 to-background",
  }[project.vertical as string] || "from-slate-900/60 to-background";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className={`relative h-56 rounded-xl overflow-hidden bg-gradient-to-br ${gradient} mb-0`}>
        {coverSrc && <img src={coverSrc} alt={project.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <VerticalBadge v={project.vertical} />
            <StatusBadge status={project.status || "active"} />
          </div>
          <h1 className="text-display text-2xl font-extrabold text-white">{project.title}</h1>
        </div>
      </div>

      {/* Owner + actions */}
      <div className="bg-card border-x border-b border-border rounded-b-xl px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        {project.owner && (
          <Link href={`/profile/${project.owner.id}`}>
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar className="w-8 h-8">
                <AvatarImage src={project.owner.avatar} />
                <AvatarFallback>{project.owner.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{project.owner.displayName || project.owner.username}</p>
                <p className="text-xs text-muted-foreground">@{project.owner.username}</p>
              </div>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => likeMut.mutate()} disabled={likeMut.isPending}
            data-testid="btn-like-project">
            <Heart className={`w-4 h-4 ${project.liked ? "fill-red-400 text-red-400" : ""}`} />
            {project.like_count || 0}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => followMut.mutate()} disabled={followMut.isPending}
            data-testid="btn-follow-project">
            <UserPlus className="w-4 h-4" /> Follow
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Updates", value: project.update_count || 0, icon: BookOpen },
          { label: "Likes", value: project.like_count || 0, icon: Heart },
          { label: "Views", value: project.view_count || 0, icon: Eye },
          { label: "Followers", value: project.follower_count || 0, icon: UserPlus },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-display text-lg font-extrabold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      {project.description && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
        </div>
      )}

      {/* Updates */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Build Log</h2>
        {isOwner && <PostUpdateForm projectId={id} cfBase={cfBase} videoEnabled={!!videoEnabled} />}
      </div>

      {updatesLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : (updates as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No updates yet</p>
          {isOwner && <p className="text-sm text-muted-foreground mt-1">Post your first build update above</p>}
        </div>
      ) : (
        <div className="relative">
          {(updates as any[]).map((u: any) => (
            <UpdateCard key={u.id} update={u} isOwner={isOwner} projectId={id} cfBase={cfBase} />
          ))}
        </div>
      )}
    </div>
  );
}
