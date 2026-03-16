import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Users, Lock, Plus, TrendingUp, Loader2 } from "lucide-react";

const CATEGORIES = ["All", "Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "Off-Road", "Boats", "Firearms", "Antiques", "General"];
const CREATE_CATEGORIES = CATEGORIES.filter(c => c !== "All");

function GroupCard({ group }: { group: any }) {
  return (
    <Link href={`/groups/${group.id}`}>
      <div
        className="bg-card rounded-xl border border-border overflow-hidden hover-elevate cursor-pointer group transition-colors hover:border-primary/40"
        data-testid={`card-group-${group.id}`}
      >
        {/* Cover */}
        <div className="relative h-36 bg-secondary overflow-hidden">
          {group.coverImage ? (
            <img
              src={group.coverImage}
              alt={group.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-70"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🏁</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          {group.private && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="bg-background/70 backdrop-blur-sm text-xs gap-1">
                <Lock className="w-3 h-3" /> Private
              </Badge>
            </div>
          )}
          <div className="absolute bottom-2 left-3">
            <Badge className="bg-primary/90 text-primary-foreground text-xs">{group.category}</Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-bold text-base mb-1 line-clamp-1">{group.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{group.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {(group.memberCount || 0).toLocaleString()} members
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {(group.postCount || 0).toLocaleString()} posts
              </span>
            </div>
            <Button
              size="sm" variant="outline" className="text-xs h-7 px-3"
              data-testid={`button-join-group-${group.id}`}
              onClick={e => e.preventDefault()}
            >
              View
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function GroupsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", activeCategory],
    queryFn: () => {
      const url = activeCategory === "All"
        ? "/api/groups"
        : `/api/groups?category=${encodeURIComponent(activeCategory)}`;
      return apiRequest("GET", url).then(r => r.json());
    },
  });

  const { mutate: createGroup, isPending: creating } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/groups", {
        name: name.trim(),
        description: description.trim(),
        category,
        private: isPrivate,
      }).then(r => r.json()),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateOpen(false);
      setName(""); setDescription(""); setCategory(""); setIsPrivate(false);
      toast({ title: "Group created!", description: `${group.name} is now live.` });
      navigate(`/groups/${group.id}`);
    },
    onError: () => toast({ title: "Error", description: "Could not create group. Try again.", variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Description required", variant: "destructive" }); return; }
    if (!category) { toast({ title: "Category required", variant: "destructive" }); return; }
    createGroup();
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Sign in to create a group." });
      return;
    }
    setCreateOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-3xl font-extrabold mb-1">Communities</h1>
          <p className="text-muted-foreground text-sm">
            Connect with riders, racers, and enthusiasts in your niche.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate} data-testid="button-create-group">
          <Plus className="w-4 h-4" /> Create Group
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            data-testid={`filter-group-category-${cat.toLowerCase()}`}
            onClick={() => setActiveCategory(cat)}
            className={`category-pill shrink-0 border ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Groups grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
              <Skeleton className="h-36 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No groups in this category yet</p>
          <p className="text-sm mt-1">Be the first to create one.</p>
          <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> Create Group</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => <GroupCard key={group.id} group={group} />)}
        </div>
      )}

      {/* ── Create Group Dialog ────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a Group</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Group Name *</label>
              <Input
                data-testid="input-group-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Desert Riders Southwest"
                maxLength={60}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                data-testid="input-group-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this group about? Who should join?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category *</label>
              <Select onValueChange={setCategory} value={category}>
                <SelectTrigger data-testid="select-group-category">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  {CREATE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Private Group</p>
                <p className="text-xs text-muted-foreground">Members must be approved to join</p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                data-testid="switch-group-private"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} data-testid="button-submit-create-group">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
