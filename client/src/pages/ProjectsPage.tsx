import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wrench, Plus, Loader2, Heart, Eye, BookOpen, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";

const VERTICALS_FILTER = ["All", "Automotive", "Tech", "Music", "Firearms", "Maker", "Powersports", "General"];
const VERTICALS = ["automotive", "tech", "music", "firearms", "maker", "powersports", "general"];
const VERTICAL_LABELS: Record<string, string> = {
  automotive: "Automotive", tech: "Tech", music: "Music", firearms: "Firearms",
  maker: "Maker", powersports: "Powersports", general: "General",
};

const GRADIENT_MAP: Record<string, string> = {
  automotive: "from-blue-600/20 to-blue-900/20",
  tech: "from-cyan-600/20 to-cyan-900/20",
  music: "from-purple-600/20 to-purple-900/20",
  firearms: "from-orange-600/20 to-orange-900/20",
  maker: "from-green-600/20 to-green-900/20",
  powersports: "from-yellow-600/20 to-yellow-900/20",
  general: "from-slate-600/20 to-slate-900/20",
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
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[v] || colors.general}`}>
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
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] || map.active}`}>{status}</span>;
}

// ── Create Project Dialog ─────────────────────────────────────
export function CreateProjectDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("automotive");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [, navigate] = useLocation();

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/projects", {
      title, vertical, description,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      is_public: isPublic,
    }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/community/projects"] });
      toast({ title: "Project created" });
      onSuccess?.();
      onClose();
      if (data?.id) navigate(`/projects/${data.id}`);
    },
    onError: () => toast({ title: "Error creating project", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Start a Project</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. LS Swap Build Journal" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vertical</label>
            <Select value={vertical} onValueChange={setVertical}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags (comma-separated)</label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="ls swap, turbo, drag" />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Public</label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending} data-testid="btn-create-project">
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Project Card ──────────────────────────────────────────────
function ProjectCard({ project, cfBase }: { project: any; cfBase: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const imgSrc = project.cover_image ? cfImageUrl(cfBase, project.cover_image) : null;
  const gradient = GRADIENT_MAP[project.vertical?.toLowerCase()] || GRADIENT_MAP.general;

  const followMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/projects/${project.id}/follow`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/community/projects"] }); toast({ title: "Following project" }); },
    onError: () => toast({ title: !user ? "Sign in to follow" : "Error", variant: "destructive" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors group"
      data-testid={`project-card-${project.id}`}>
      <Link href={`/projects/${project.id}`}>
        <div className={`h-40 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden cursor-pointer`}>
          {imgSrc
            ? <img src={imgSrc} alt={project.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            : <Wrench className="w-10 h-10 text-muted-foreground opacity-30" />}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <VerticalBadge v={project.vertical || "general"} />
          <StatusBadge status={project.status || "active"} />
        </div>
        <Link href={`/projects/${project.id}`}>
          <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors cursor-pointer mb-1">{project.title}</h3>
        </Link>
        {project.owner && (
          <Link href={`/profile/${project.owner.id}`}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer">
              <Avatar className="w-4 h-4"><AvatarImage src={project.owner.avatar} /><AvatarFallback>{project.owner.displayName?.[0]}</AvatarFallback></Avatar>
              {project.owner.displayName || project.owner.username}
            </div>
          </Link>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{project.update_count || 0}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{project.like_count || 0}</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{project.view_count || 0}</span>
        </div>
        {project.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {project.tags.slice(0, 3).map((t: string) => (
              <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7"
          onClick={() => followMut.mutate()} disabled={followMut.isPending}
          data-testid={`btn-follow-project-${project.id}`}>
          {followMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3" /> Follow Project</>}
        </Button>
      </div>
    </div>
  );
}

// ── Main ProjectsPage ─────────────────────────────────────────
export default function ProjectsPage() {
  const [activeVertical, setActiveVertical] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const cfBase = useCfUrl();

  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/community/projects", activeVertical],
    queryFn: () => {
      const params = activeVertical !== "All" ? `?vertical=${activeVertical.toLowerCase()}` : "";
      return apiRequest("GET", `/api/community/projects${params}`).then(r => r.json());
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-3xl font-extrabold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Build journals from the community</p>
        </div>
        {user && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5" data-testid="btn-start-project-open">
            <Plus className="w-4 h-4" /> Start a Project
          </Button>
        )}
      </div>

      {/* Vertical filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {VERTICALS_FILTER.map(v => (
          <button key={v} onClick={() => setActiveVertical(v)}
            data-testid={`filter-vertical-${v.toLowerCase()}`}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeVertical === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}>{v}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : (projects as any[]).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-semibold">No projects yet</p>
          {user && <p className="text-sm mt-1">Start documenting your build!</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as any[]).map((p: any) => <ProjectCard key={p.id} project={p} cfBase={cfBase} />)}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
