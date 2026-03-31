import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient as qc0 } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/StarRating";
import ListingCard from "@/components/ListingCard";
import { AvatarUploader } from "@/components/ImageUploader";
import ImageUploader from "@/components/ImageUploader";
import { PostImageGrid } from "@/components/ImageLightbox";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import {
  ShieldCheck, MapPin, Calendar, MessageSquare, Star, Clock, Pencil, Loader2,
  UserPlus, UserCheck, Pin, Trash2, Plus, Globe, Youtube, Instagram, Github,
  Twitch, Facebook, Award, Car, ChevronRight, Wrench, Image as ImageIcon, Send,
  BookOpen, Package, X,
} from "lucide-react";
import { useState as useS } from "react";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import ReportButton from "@/components/ReportButton";
import { guideUrl, profileUrl, timeAgo } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────
type Tab = "listings" | "reviews" | "posts" | "garage" | "projects" | "badges" | "guides";

// ── Badge definitions ─────────────────────────────────────────
const BADGE_DEFS: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  first_sale: { label: "First Sale", icon: "🏷️", desc: "Completed your first sale", color: "text-green-400" },
  seller_10: { label: "Power Seller", icon: "⚡", desc: "10 completed sales", color: "text-yellow-400" },
  seller_50: { label: "Top Trader", icon: "🏆", desc: "50 completed sales", color: "text-orange-400" },
  seller_100: { label: "Legend", icon: "💎", desc: "100 completed sales", color: "text-purple-400" },
  first_listing: { label: "Lister", icon: "📋", desc: "Created your first listing", color: "text-blue-400" },
  guide_author: { label: "Guide Author", icon: "📖", desc: "Wrote your first guide", color: "text-cyan-400" },
  guide_10: { label: "Expert", icon: "🎓", desc: "Wrote 10 guides", color: "text-indigo-400" },
  group_founder: { label: "Founder", icon: "🏛️", desc: "Created a community group", color: "text-amber-400" },
  group_admin: { label: "Admin", icon: "🛡️", desc: "Group administrator", color: "text-slate-400" },
  follower_10: { label: "Rising Star", icon: "⭐", desc: "10 followers", color: "text-yellow-300" },
  follower_100: { label: "Influencer", icon: "🌟", desc: "100 followers", color: "text-yellow-400" },
  follower_1k: { label: "Icon", icon: "👑", desc: "1,000 followers", color: "text-primary" },
  early_adopter: { label: "Early Adopter", icon: "🚀", desc: "One of the first WhipGuides members", color: "text-primary" },
};

const VERTICALS = ["automotive", "music", "tech", "firearms", "powersports", "general"] as const;
const VERTICAL_LABELS: Record<string, string> = {
  automotive: "Automotive", music: "Music", tech: "Tech", firearms: "Firearms", powersports: "Powersports", general: "General",
};

// ── Vertical badge color ──────────────────────────────────────
function VerticalBadge({ v }: { v: string }) {
  const colors: Record<string, string> = {
    automotive: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    music: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    tech: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    firearms: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    powersports: "bg-green-500/15 text-green-400 border-green-500/30",
    general: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[v] || colors.general}`}>
      {VERTICAL_LABELS[v] || v}
    </span>
  );
}

// ── YouTube embed helper ──────────────────────────────────────
function extractYouTubeId(text: string): string | null {
  const m = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Social icon link ─────────────────────────────────────────
function SocialLink({ platform, handle }: { platform: string; handle: string }) {
  if (!handle) return null;
  const config: Record<string, { icon: JSX.Element; url: string; color: string }> = {
    youtube: { icon: <Youtube className="w-4 h-4" />, url: `https://youtube.com/@${handle}`, color: "text-red-400 hover:text-red-300" },
    instagram: { icon: <Instagram className="w-4 h-4" />, url: `https://instagram.com/${handle}`, color: "text-pink-400 hover:text-pink-300" },
    tiktok: { icon: <span className="text-sm font-bold leading-none">TT</span>, url: `https://tiktok.com/@${handle}`, color: "text-foreground hover:text-primary" },
    x: { icon: <X className="w-4 h-4" />, url: `https://x.com/${handle}`, color: "text-foreground hover:text-primary" },
    github: { icon: <Github className="w-4 h-4" />, url: `https://github.com/${handle}`, color: "text-foreground hover:text-primary" },
    twitch: { icon: <Twitch className="w-4 h-4" />, url: `https://twitch.tv/${handle}`, color: "text-purple-400 hover:text-purple-300" },
    patreon: { icon: <span className="text-sm font-bold leading-none">P</span>, url: handle.startsWith("http") ? handle : `https://patreon.com/${handle}`, color: "text-orange-400 hover:text-orange-300" },
    facebook: { icon: <Facebook className="w-4 h-4" />, url: handle.startsWith("http") ? handle : `https://facebook.com/${handle}`, color: "text-blue-400 hover:text-blue-300" },
    website: { icon: <Globe className="w-4 h-4" />, url: handle.startsWith("http") ? handle : `https://${handle}`, color: "text-muted-foreground hover:text-foreground" },
  };
  const c = config[platform];
  if (!c) return null;
  return (
    <a href={c.url} target="_blank" rel="noopener noreferrer"
      className={`flex items-center justify-center w-8 h-8 rounded-full bg-secondary hover:bg-muted/80 transition-colors ${c.color}`}
      title={platform}>
      {c.icon}
    </a>
  );
}

// ── Follow Button ─────────────────────────────────────────────
function FollowButton({ targetId }: { targetId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: status } = useQuery<{ following: boolean }>({
    queryKey: ["/api/feed/follow-status", targetId],
    queryFn: () => apiRequest("GET", `/api/feed/follow-status/${targetId}`).then(r => r.json()),
    enabled: !!user,
  });
  const followMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/feed/follow/${targetId}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/feed/follow-status", targetId] }); toast({ title: "Following" }); },
  });
  const unfollowMut = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/feed/follow/${targetId}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/feed/follow-status", targetId] }); toast({ title: "Unfollowed" }); },
  });
  if (!user) return null;
  const following = status?.following ?? false;
  return (
    <Button variant={following ? "outline" : "default"} size="sm" className="gap-1.5 shrink-0"
      disabled={followMut.isPending || unfollowMut.isPending}
      onClick={() => following ? unfollowMut.mutate() : followMut.mutate()}
      data-testid={`button-follow-${targetId}`}>
      {following ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
    </Button>
  );
}

// ── Post Composer ─────────────────────────────────────────────
function PostComposer({ userId }: { userId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const cfBase = useCfUrl();
  const postMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/posts", { content, user_id: userId }).then(r => r.json()),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["/api/community", userId, "posts"] });
      toast({ title: "Posted" });
    },
    onError: () => toast({ title: "Couldn't post", variant: "destructive" }),
  });
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
      <Textarea placeholder="Share an update..." value={content} onChange={e => setContent(e.target.value)}
        rows={3} className="resize-none bg-secondary border-0 text-sm" />
      <div className="flex justify-end">
        <Button size="sm" disabled={!content.trim() || postMut.isPending}
          onClick={() => postMut.mutate()} data-testid="btn-compose-post">
          {postMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" />Post</>}
        </Button>
      </div>
    </div>
  );
}

// ── Profile Post Card ─────────────────────────────────────────
function ProfilePostCard({ post, isOwner, userId }: { post: any; isOwner: boolean; userId: number }) {
  const cfBase = useCfUrl();
  const qc = useQueryClient();
  const { toast } = useToast();
  const ytId = post.content ? extractYouTubeId(post.content) : null;
  const images: string[] = (post.images || []).map((id: string) =>
    id.startsWith("http") || id.startsWith("data:") ? id : cfBase ? `${cfBase}/${id}/public` : id
  );
  const pinMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/community/${userId}/pin/${post.id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/community", userId, "posts"] }); toast({ title: "Post pinned" }); },
  });
  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${post.pinned ? "border-primary/40" : ""}`}
      data-testid={`profile-post-${post.id}`}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-primary font-medium bg-primary/5 border-b border-primary/20">
          <Pin className="w-3 h-3" /> Pinned post
        </div>
      )}
      <div className="p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
        {ytId && (
          <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl mb-3 border border-border">
            <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}
        {images.length > 0 && <div className="mb-3"><PostImageGrid images={images} /></div>}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>{timeAgo(post.created_at)}</span>
          <div className="flex items-center gap-2">
            {(post.likes || 0) > 0 && <span>{post.likes} ❤️</span>}
            {isOwner && (
              <button onClick={() => pinMut.mutate()}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
                title="Pin post">
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Garage Item Card ──────────────────────────────────────────
function GarageItemCard({ item, isOwner, cfBase, onDelete }: { item: any; isOwner: boolean; cfBase: string; onDelete: () => void }) {
  const imgSrc = item.images?.[0] ? cfImageUrl(cfBase, item.images[0]) : null;
  const d = item.item_data || {};
  const subtitle = d.year && d.make && d.model ? `${d.year} ${d.make} ${d.model}` :
    d.brand && d.model ? `${d.brand} ${d.model}` : d.name || "";
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group" data-testid={`garage-item-${item.id}`}>
      <div className="h-40 bg-secondary flex items-center justify-center overflow-hidden">
        {imgSrc ? <img src={imgSrc} alt={item.title} className="w-full h-full object-cover" /> :
          <Car className="w-10 h-10 text-muted-foreground opacity-30" />}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
          <VerticalBadge v={item.vertical || "general"} />
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {isOwner && (
          <button onClick={onDelete}
            className="mt-2 text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add to Garage Dialog ──────────────────────────────────────
function AddGarageDialog({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [vertical, setVertical] = useState("automotive");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemData, setItemData] = useState<Record<string, string>>({});
  const setField = (k: string, v: string) => setItemData(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/garage", { user_id: userId, vertical, title, description, item_data: itemData }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community/garage", userId] });
      toast({ title: "Added to garage" });
      onClose();
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const fields: Record<string, Array<{ k: string; label: string; type?: string }>> = {
    automotive: [{ k: "year", label: "Year" }, { k: "make", label: "Make" }, { k: "model", label: "Model" }, { k: "trim", label: "Trim" }, { k: "color", label: "Color" }],
    music: [{ k: "brand", label: "Brand" }, { k: "model", label: "Model" }, { k: "type", label: "Type" }],
    tech: [{ k: "brand", label: "Brand" }, { k: "model", label: "Model" }, { k: "type", label: "Type" }],
    firearms: [{ k: "make", label: "Make" }, { k: "model", label: "Model" }, { k: "caliber", label: "Caliber" }, { k: "type", label: "Type" }],
    powersports: [{ k: "year", label: "Year" }, { k: "make", label: "Make" }, { k: "model", label: "Model" }, { k: "type", label: "Type" }],
    general: [{ k: "name", label: "Name" }],
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add to Garage</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <Select value={vertical} onValueChange={v => { setVertical(v); setItemData({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My 2019 Mustang GT" />
          </div>
          {(fields[vertical] || []).map(f => (
            <div key={f.k} className="space-y-1.5">
              <label className="text-sm font-medium">{f.label}</label>
              <Input value={itemData[f.k] || ""} onChange={e => setField(f.k, e.target.value)} placeholder={f.label} />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional notes..." className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending} data-testid="btn-add-garage">
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Start Project Dialog ──────────────────────────────────────
function StartProjectDialog({ open, onClose, userId, garageItems }: { open: boolean; onClose: () => void; userId: number; garageItems: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("automotive");
  const [description, setDescription] = useState("");
  const [garageItemId, setGarageItemId] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/projects", {
      user_id: userId, title, vertical, description, tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      garage_item_id: garageItemId ? Number(garageItemId) : undefined, is_public: isPublic,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community/projects"] });
      toast({ title: "Project created" });
      onClose();
    },
    onError: () => toast({ title: "Error creating project", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Start a Project</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. LS Swap Build" />
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
          {garageItems.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Link to Garage Item (optional)</label>
              <Select value={garageItemId} onValueChange={setGarageItemId}>
                <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {garageItems.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending} data-testid="btn-start-project">
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Project status badge ──────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    complete: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    abandoned: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] || map.active}`}>{status}</span>;
}

// ── Main Component ────────────────────────────────────────────
export default function ProfilePage({ id }: { id: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("listings");
  const [editOpen, setEditOpen] = useState(false);
  const [editDialogTab, setEditDialogTab] = useState<"profile" | "creator">("profile");
  const [addGarageOpen, setAddGarageOpen] = useState(false);
  const [startProjectOpen, setStartProjectOpen] = useState(false);
  const { user: currentUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const isOwnProfile = currentUser?.id === id;
  const [, navigate] = useLocation();
  const cfBase = useCfUrl();
  const qc = useQueryClient();

  // ── Edit state ─────────────────────────────────────────────
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvatarId, setEditAvatarId] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editCoverId, setEditCoverId] = useState<string | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  // Creator fields
  const [editWebsite, setEditWebsite] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editTiktok, setEditTiktok] = useState("");
  const [editX, setEditX] = useState("");
  const [editGithub, setEditGithub] = useState("");
  const [editTwitch, setEditTwitch] = useState("");
  const [editPatreon, setEditPatreon] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editSpecialistTags, setEditSpecialistTags] = useState("");

  // ── Queries ─────────────────────────────────────────────────
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/users", id],
    queryFn: () => apiRequest("GET", `/api/users/${id}`).then(r => r.json()),
  });

    // SEO
  const _seoName = user ? (user.displayName || user.username || "Profile") : "Profile";
  useSEO({
    title: _seoName,
    description: user?.bio?.slice(0, 160) || `${_seoName}'s profile on WhipGuides`,
    image: user?.avatar || null,
    url: `${window.location.origin}${profileUrl(id, user?.displayName || user?.username)}`,
    type: "profile",
  });
  const { data: allListings = [], isLoading: listingsLoading } = useQuery<any[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", "/api/listings").then(r => r.json()),
  });
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: ["/api/users", id, "reviews"],
    queryFn: () => apiRequest("GET", `/api/users/${id}/reviews`).then(r => r.json()),
  });
  const { data: profilePosts = [], isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/community", id, "posts"],
    queryFn: () => apiRequest("GET", `/api/community/${id}/posts`).then(r => r.json()),
    enabled: activeTab === "posts",
  });
  const { data: garageItems = [], isLoading: garageLoading } = useQuery<any[]>({
    queryKey: ["/api/community/garage", id],
    queryFn: () => apiRequest("GET", `/api/community/garage/${id}`).then(r => r.json()),
    enabled: activeTab === "garage",
  });
  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ["/api/community/projects", id],
    queryFn: () => apiRequest("GET", `/api/community/projects?user_id=${id}`).then(r => r.json()),
    enabled: activeTab === "projects",
  });
  const { data: badges = [], isLoading: badgesLoading } = useQuery<any[]>({
    queryKey: ["/api/community/badges", id],
    queryFn: () => apiRequest("GET", `/api/community/badges/${id}`).then(r => r.json()),
    enabled: activeTab === "badges",
  });

  const { data: userGuides, isLoading: guidesLoading } = useQuery<any[]>({
    queryKey: ["/api/guides", { authorId: id, sortBy: "quality" }],
    queryFn: () => apiRequest("GET", `/api/guides?authorId=${id}&sortBy=quality`).then(r => r.json()),
    enabled: activeTab === "guides",
  });

  const { mutate: messageUser, isPending: messagingUser } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/conversations", { otherUserId: id }).then(r => r.json()),
    onSuccess: () => { qc0.invalidateQueries({ queryKey: ["/api/conversations"] }); navigate("/messages"); },
    onError: () => toast({ title: "Error", description: "Could not start conversation.", variant: "destructive" }),
  });

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      // Two parallel updates: users table (basic fields + cover) and community profile (social/creator fields)
      await Promise.all([
        apiRequest("PATCH", `/api/users/${id}`, {
          displayName: editDisplayName,
          bio: editBio,
          location: editLocation,
          ...(editAvatarId   ? { avatar:      editAvatarPreview  || editAvatarId }  : {}),
          // cover_image: only send if a new cover was chosen and uploaded
          ...(editCoverId && editCoverId !== "pending" ? { cover_image: editCoverPreview || editCoverId } : {}),
        }),
        // Social links use the DB column names (youtube_handle etc.)
        apiRequest("PATCH", "/api/community/profile", {
          website:         editWebsite   || null,
          youtube_handle:  editYoutube   || null,
          instagram_handle: editInstagram || null,
          tiktok_handle:   editTiktok    || null,
          x_handle:        editX         || null,
          github_handle:   editGithub    || null,
          twitch_handle:   editTwitch    || null,
          patreon_url:     editPatreon   || null,
          facebook_url:    editFacebook  || null,
          specialist_tags: editSpecialistTags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users", id] });
      refreshUser();
      setEditCoverId(null); setEditCoverPreview(null);
      setEditOpen(false);
      toast({ title: "Profile updated" });
    },
    onError: (err: any) => toast({ title: "Error saving profile", description: err?.message, variant: "destructive" }),
  });

  const creatorModeMut = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/community/profile", { creator_mode: true }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users", id] }); toast({ title: "Creator mode activated!" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const checkBadgesMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/badges/check").then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/community/badges", id] }); toast({ title: "Badges checked!" }); },
  });

  const deleteGarageMut = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/community/garage/${itemId}`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/community/garage", id] }),
  });

  const openEdit = () => {
    setEditDisplayName(user?.displayName || "");
    setEditBio(user?.bio || "");
    setEditLocation(user?.location || "");
    setEditAvatarId(null); setEditAvatarPreview(null);
    setEditCoverId(null); setEditCoverPreview(null);
    setEditWebsite(user?.website || "");
    setEditYoutube(user?.youtube || "");
    setEditInstagram(user?.instagram || "");
    setEditTiktok(user?.tiktok || "");
    setEditX(user?.x || "");
    setEditGithub(user?.github || "");
    setEditTwitch(user?.twitch || "");
    setEditPatreon(user?.patreon || "");
    setEditFacebook(user?.facebook || "");
    setEditSpecialistTags((user?.specialist_tags || []).join(", "));
    setEditOpen(true);
  };

  if (userLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="flex items-center gap-4 -mt-10 px-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-60" /></div>
      </div>
    </div>
  );
  if (!user) return <div className="p-8 text-center text-muted-foreground">User not found.</div>;

  const userListings = allListings.filter((l: any) => l.sellerId === id);
  const coverSrc = user.cover_image ? cfImageUrl(cfBase, user.cover_image) : null;
  const showPostsTab = user.creator_mode || isOwnProfile;
  const sortedPosts = [...(profilePosts as any[])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const socialLinks = [
    { platform: "youtube", handle: user.youtube },
    { platform: "instagram", handle: user.instagram },
    { platform: "tiktok", handle: user.tiktok },
    { platform: "x", handle: user.x },
    { platform: "github", handle: user.github },
    { platform: "twitch", handle: user.twitch },
    { platform: "patreon", handle: user.patreon },
    { platform: "facebook", handle: user.facebook },
    { platform: "website", handle: user.website },
  ].filter(s => s.handle);

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star, count: reviews.filter((r: any) => r.rating === star).length,
    pct: reviews.length ? (reviews.filter((r: any) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  const ALL_TABS: Tab[] = ["listings", "guides", ...(showPostsTab ? ["posts" as Tab] : []), "garage", "projects", "badges", "reviews"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Cover image */}
      <div className="relative h-36 rounded-t-xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-secondary">
        {coverSrc && <img src={coverSrc} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        {/* Cover hover hint — subtle camera icon overlay */}
        {isOwnProfile && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 rounded-t-xl pointer-events-none">
            <div className="flex items-center gap-1.5 text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-full">
              <ImageIcon className="w-3.5 h-3.5" /> Click below to change cover
            </div>
          </div>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-card rounded-b-xl border-x border-b border-border px-6 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 -mt-10 relative z-10">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="w-20 h-20 border-4 border-card shadow-lg">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-2xl">{user.displayName?.[0]}</AvatarFallback>
            </Avatar>
            {user.verified && (
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-10 sm:pt-2">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-display text-2xl font-extrabold">{user.displayName}</h1>
                  {user.verified && (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-xs gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                  {user.creator_mode && (
                    <Badge className="bg-primary text-primary-foreground text-xs gap-1">Creator</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-2">@{user.username}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {user.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{user.location}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Member since {user.memberSince}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{user.responseTime}</span>
                  {user.follower_count != null && (
                    <span className="font-medium">{(user.follower_count || 0).toLocaleString()} followers</span>
                  )}
                  {user.following_count != null && (
                    <span className="font-medium">{(user.following_count || 0).toLocaleString()} following</span>
                  )}
                </div>
              </div>
              {/* Action buttons — own profile vs. other user */}
              {isOwnProfile ? (
                <div className="flex flex-col gap-2 items-end shrink-0">
                  {/* Row 1: primary actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit} data-testid="button-edit-profile">
                      <Pencil className="w-3.5 h-3.5" /> Edit Profile
                    </Button>
                    {!user.creator_mode && (
                      <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => creatorModeMut.mutate()} disabled={creatorModeMut.isPending}
                        data-testid="btn-activate-creator">
                        {creatorModeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Star className="w-3.5 h-3.5" /> Creator Page</>}
                      </Button>
                    )}
                  </div>
                  {/* Row 2: Change cover — crop + real upload + instant save */}
                  <div className="flex items-center gap-2">
                    <AvatarUploader
                      currentUrl={user.cover_image
                        ? (user.cover_image.startsWith('http') || user.cover_image.startsWith('data:')
                            ? user.cover_image
                            : cfBase ? `${cfBase}/${user.cover_image}/public` : null)
                        : null}
                      onUpload={async (imgId, cdnUrl) => {
                        // Upload done — immediately save to DB and refresh
                        const url = cdnUrl || imgId;
                        await apiRequest("PATCH", `/api/users/${id}`, { cover_image: url });
                        qc.invalidateQueries({ queryKey: ["/api/users", id] });
                        toast({ title: "Cover photo updated" });
                      }}
                      size={32}
                    />
                    <span className="text-xs text-muted-foreground">Change cover</span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <FollowButton targetId={id} />
                  <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-message-user"
                    onClick={() => { if (!currentUser) { toast({ title: "Sign in required" }); return; } messageUser(); }}
                    disabled={messagingUser}>
                    <MessageSquare className="w-3.5 h-3.5" /> {messagingUser ? "Opening..." : "Message"}
                  </Button>
                  <ReportButton targetType="user" targetId={id} iconOnly className="p-2 h-8 w-8 border border-border rounded-lg flex items-center justify-center hover:bg-muted/60" />
                </div>
              )}
            </div>

            {user.bio && <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{user.bio}</p>}

            {/* Specialist tags */}
            {user.specialist_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {user.specialist_tags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {socialLinks.map(s => <SocialLink key={s.platform} platform={s.platform} handle={s.handle} />)}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 pt-5 border-t border-border grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-display text-2xl font-extrabold text-primary">{userListings.length}</p>
            <p className="text-xs text-muted-foreground">Active Listings</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <p className="text-display text-2xl font-extrabold text-primary">{user.rating?.toFixed(1) || "—"}</p>
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 mb-0.5" />
            </div>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </div>
          <div>
            <p className="text-display text-2xl font-extrabold text-primary">{user.reviewCount || 0}</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 mb-5 border-b border-border">
        {ALL_TABS.map(tab => (
          <button key={tab} data-testid={`tab-${tab}`} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px shrink-0 ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab === "listings" ? `Listings (${userListings.length})` :
             tab === "reviews" ? `Reviews (${reviews.length})` : tab}
          </button>
        ))}
      </div>

      {/* ── Listings ──────────────────────────────────────────── */}
      {activeTab === "listings" && (
        listingsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : userListings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><p className="font-semibold">No active listings</p></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userListings.map((listing: any) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )
      )}

      {/* ── Posts ──────────────────────────────────────────────── */}
      {activeTab === "posts" && showPostsTab && (
        <div>
          {isOwnProfile && <PostComposer userId={id} />}
          {postsLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : sortedPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post: any) => (
                <ProfilePostCard key={post.id} post={post} isOwner={isOwnProfile} userId={id} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Garage ─────────────────────────────────────────────── */}
      {activeTab === "garage" && (
        <div>
          {isOwnProfile && (
            <div className="mb-4">
              <Button onClick={() => setAddGarageOpen(true)} size="sm" className="gap-1.5" data-testid="btn-open-add-garage">
                <Plus className="w-4 h-4" /> Add to Garage
              </Button>
            </div>
          )}
          {garageLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : (garageItems as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>{isOwnProfile ? "Add your first vehicle or item" : "Nothing in the garage yet"}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(garageItems as any[]).map((item: any) => (
                <GarageItemCard key={item.id} item={item} isOwner={isOwnProfile} cfBase={cfBase}
                  onDelete={() => deleteGarageMut.mutate(item.id)} />
              ))}
            </div>
          )}
          <AddGarageDialog open={addGarageOpen} onClose={() => setAddGarageOpen(false)} userId={id} />
        </div>
      )}

      {/* ── Projects ───────────────────────────────────────────── */}
      {activeTab === "projects" && (
        <div>
          {isOwnProfile && (
            <div className="mb-4">
              <Button onClick={() => setStartProjectOpen(true)} size="sm" className="gap-1.5" data-testid="btn-open-start-project">
                <Plus className="w-4 h-4" /> Start a Project
              </Button>
            </div>
          )}
          {projectsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : (projects as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No projects yet</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(projects as any[]).map((proj: any) => (
                <Link key={proj.id} href={`/projects/${proj.id}`}>
                  <div className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors group"
                    data-testid={`project-card-${proj.id}`}>
                    <div className="h-36 bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center overflow-hidden">
                      {proj.cover_image ? (
                        <img src={cfImageUrl(cfBase, proj.cover_image) || ""} alt={proj.title} className="w-full h-full object-cover" />
                      ) : <Wrench className="w-10 h-10 text-muted-foreground opacity-30" />}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <VerticalBadge v={proj.vertical} />
                        <StatusBadge status={proj.status || "active"} />
                      </div>
                      <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{proj.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{proj.update_count || 0} updates</span>
                        <span>{proj.like_count || 0} likes</span>
                      </div>
                      {proj.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {proj.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <StartProjectDialog open={startProjectOpen} onClose={() => setStartProjectOpen(false)} userId={id} garageItems={garageItems as any[]} />
        </div>
      )}

      {/* ── Badges ─────────────────────────────────────────────── */}
      {activeTab === "badges" && (
        <div>
          {badgesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : (badges as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No badges earned yet</p>
              {isOwnProfile && (
                <Button variant="outline" size="sm" className="mt-4"
                  onClick={() => checkBadgesMut.mutate()} disabled={checkBadgesMut.isPending}
                  data-testid="btn-check-badges">
                  {checkBadgesMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check for new badges"}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(badges as any[]).map((b: any) => {
                const def = BADGE_DEFS[b.badge_type] || { label: b.badge_type, icon: "🏅", desc: "", color: "text-primary" };
                return (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4 text-center space-y-2"
                    data-testid={`badge-${b.badge_type}`}>
                    <span className="text-4xl">{def.icon}</span>
                    <p className={`font-bold text-sm ${def.color}`}>{def.label}</p>
                    <p className="text-xs text-muted-foreground">{def.desc}</p>
                    {b.awarded_at && <p className="text-[10px] text-muted-foreground">{new Date(b.awarded_at).toLocaleDateString()}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Reviews ────────────────────────────────────────────── */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {reviews.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 mb-2">
              <div className="flex items-start gap-8 flex-wrap">
                <div className="text-center">
                  <p className="text-display text-5xl font-extrabold text-primary">{user.rating?.toFixed(1)}</p>
                  <StarRating rating={user.rating || 0} size={16} showValue={false} />
                  <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5 min-w-[200px]">
                  {ratingBreakdown.map(({ star, count, pct }) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-right text-muted-foreground">{star}★</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {reviewsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><p className="font-semibold">No reviews yet</p></div>
          ) : (
            reviews.map((review: any) => (
              <div key={review.id} className="bg-card rounded-xl border border-border p-4" data-testid={`card-review-${review.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={review.reviewer?.avatar} />
                    <AvatarFallback>{review.reviewer?.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{review.reviewer?.displayName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{review.type}</Badge>
                        <span className="text-xs text-muted-foreground">{review.createdAt}</span>
                      </div>
                    </div>
                    <StarRating rating={review.rating} size={13} showValue={false} />
                    <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Guides Tab ─────────────────────────────────────── */}
      {activeTab === "guides" && (
        <div className="space-y-3">
          {guidesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : !userGuides || userGuides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No guides yet</p>
              {isOwnProfile && (
                <div className="mt-4">
                  <Button asChild size="sm" className="gap-1.5">
                    <a href="/guides/new"><Plus className="w-4 h-4" /> Write your first guide</a>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            userGuides.map((guide: any) => (
              <a key={guide.id} href={guideUrl(guide.id, guide.title)} className="block">
                <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors" data-testid={`profile-guide-${guide.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-1 hover:text-primary transition-colors">{guide.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {guide.vertical && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground capitalize">{guide.vertical}</span>
                        )}
                        {(guide.qualityScore ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold text-primary">Score: {guide.qualityScore}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          {guide.views ?? 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {guide.likes ?? 0}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0 ${
                      guide.difficulty === "beginner" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                      guide.difficulty === "intermediate" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                      "bg-red-500/15 text-red-400 border-red-500/20"
                    }`}>{guide.difficulty}</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      )}

      {/* ── Edit Profile Dialog ──────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <Tabs value={editDialogTab} onValueChange={v => setEditDialogTab(v as any)}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
              <TabsTrigger value="creator" className="flex-1">Creator</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-5 mt-0">
              <div className="flex flex-col items-center gap-2">
                <AvatarUploader currentUrl={user.avatar} size={88} onUpload={(imgId, prev) => { setEditAvatarId(imgId); setEditAvatarPreview(prev); }} />
                <p className="text-xs text-muted-foreground">Click to change photo</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Display Name</label>
                <Input data-testid="input-edit-displayname" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Location</label>
                <Input data-testid="input-edit-location" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="City, State" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bio</label>
                <Textarea data-testid="input-edit-bio" value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} className="resize-none" />
              </div>
            </TabsContent>

            <TabsContent value="creator" className="space-y-4 mt-0">
              {[
                { label: "Website URL", val: editWebsite, set: setEditWebsite, ph: "https://yoursite.com" },
                { label: "YouTube handle (@channel)", val: editYoutube, set: setEditYoutube, ph: "channelname" },
                { label: "Instagram handle", val: editInstagram, set: setEditInstagram, ph: "handle" },
                { label: "TikTok handle", val: editTiktok, set: setEditTiktok, ph: "handle" },
                { label: "X/Twitter handle", val: editX, set: setEditX, ph: "handle" },
                { label: "GitHub handle", val: editGithub, set: setEditGithub, ph: "handle" },
                { label: "Twitch handle", val: editTwitch, set: setEditTwitch, ph: "handle" },
                { label: "Patreon URL", val: editPatreon, set: setEditPatreon, ph: "https://patreon.com/..." },
                { label: "Facebook URL", val: editFacebook, set: setEditFacebook, ph: "https://facebook.com/..." },
              ].map(f => (
                <div key={f.label} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <Input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Specialist tags (comma-separated)</label>
                <Input value={editSpecialistTags} onChange={e => setEditSpecialistTags(e.target.value)} placeholder="e.g. LS Swap, Track Builds, 3D Printing" />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => saveProfile()} disabled={isSaving} data-testid="button-save-profile">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
