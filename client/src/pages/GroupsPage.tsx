import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { GroupSetupWizard } from "@/components/GroupSetupWizard";
import {
  Users, Lock, Plus, TrendingUp, Loader2, Search,
  X, Sparkles, ChevronRight, BookOpen,
} from "lucide-react";

const VERTICALS_ROW = ["All", "Automotive", "Tech & AI", "Music", "Maker", "Outdoors", "Firearms", "Collectibles", "Powersports", "General"];

const CATEGORIES = [
  "All",
  // Automotive
  "Cars", "Trucks", "SUVs", "Muscle Cars", "Import Tuner", "Classic Cars", "Off-Road",
  // Powersports
  "Motorcycles", "ATVs", "UTVs", "Jet Skis", "Boats", "Snowmobiles", "Dirt Bikes",
  // Tech & AI
  "3D Printing", "Drones", "Robotics", "Electronics", "AI & Machine Learning", "Computers",
  // Music
  "Guitar", "Bass", "Drums", "Keys & Synth", "Recording Studio", "Live Sound",
  // Maker
  "Woodworking", "CNC", "Metal Fabrication", "Welding", "DIY & Homestead",
  // Outdoors
  "Hunting", "Fishing", "Camping", "Hiking", "Off-Grid Living",
  // Firearms
  "Handguns", "Rifles", "Shotguns", "Long Range", "Concealed Carry",
  // Collectibles
  "Antiques", "Trading Cards", "Comics", "Coins", "Memorabilia",
  // General
  "General",
];
const CREATE_CATEGORIES = CATEGORIES.filter(c => c !== "All");

const VERTICAL_MAP: Record<string, string> = {
  Cars: "automotive", Trucks: "automotive", SUVs: "automotive", "Muscle Cars": "automotive",
  "Import Tuner": "automotive", "Classic Cars": "automotive", "Off-Road": "automotive",
  Motorcycles: "powersports", ATVs: "powersports", UTVs: "powersports", "Jet Skis": "powersports",
  Boats: "powersports", Snowmobiles: "powersports", "Dirt Bikes": "powersports",
  "3D Printing": "tech", Drones: "tech", Robotics: "tech", Electronics: "tech",
  "AI & Machine Learning": "tech", Computers: "tech",
  Guitar: "music", Bass: "music", Drums: "music", "Keys & Synth": "music",
  "Recording Studio": "music", "Live Sound": "music",
  Woodworking: "maker", CNC: "maker", "Metal Fabrication": "maker", Welding: "maker",
  "DIY & Homestead": "maker",
  Hunting: "outdoors", Fishing: "outdoors", Camping: "outdoors", Hiking: "outdoors",
  "Off-Grid Living": "outdoors",
  Handguns: "firearms", Rifles: "firearms", Shotguns: "firearms", "Long Range": "firearms",
  "Concealed Carry": "firearms",
  Antiques: "collectibles", "Trading Cards": "collectibles", Comics: "collectibles",
  Coins: "collectibles", Memorabilia: "collectibles",
  General: "general",
};

// ── Browsing history hook (persists category + search affinity in memory) ──
const _browsedCategories: string[] = [];
const _searchedTerms: string[] = [];

function recordBrowse(category: string) {
  if (category !== "All" && !_browsedCategories.includes(category)) {
    _browsedCategories.unshift(category);
    if (_browsedCategories.length > 5) _browsedCategories.pop();
  }
}

function recordSearch(term: string) {
  if (term && !_searchedTerms.includes(term)) {
    _searchedTerms.unshift(term);
    if (_searchedTerms.length > 10) _searchedTerms.pop();
  }
}

// ── Group card ──────────────────────────────────────────────
function GroupCard({ group, compact = false }: { group: any; compact?: boolean }) {
  if (compact) {
    return (
      <Link href={`/groups/${group.id}`}>
        <div
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group border border-border hover:border-primary/30"
          data-testid={`card-group-compact-${group.id}`}
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0 border border-border">
            {group.coverImage
              ? <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-lg opacity-30">🏁</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{group.name}</p>
              {group.private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(group.memberCount || 0).toLocaleString()}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{group.category}</Badge>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/groups/${group.id}`} className="block h-full">
      {/* flex flex-col h-full ensures every card stretches to the tallest in its row */}
      <div
        className="bg-card rounded-xl border border-border overflow-hidden hover-elevate cursor-pointer group transition-colors hover:border-primary/40 flex flex-col h-full"
        data-testid={`card-group-${group.id}`}
      >
        {/* Fixed-height cover — always 144px regardless of content below */}
        <div className="relative h-36 bg-secondary overflow-hidden shrink-0">
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
        {/* flex-col + flex-1 stretches this section; footer is always pinned to bottom */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-base mb-1 line-clamp-1">{group.name}</h3>
          {/* line-clamp-2 truncates long descriptions; flex-1 pushes footer down */}
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{group.description || <span className="opacity-40 italic">No description</span>}</p>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />{(group.memberCount || 0).toLocaleString()} members
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />{(group.postCount || 0).toLocaleString()} posts
              </span>
            </div>
            <Button
              size="sm" variant="outline" className="text-xs h-7 px-3 gap-1"
              data-testid={`button-join-group-${group.id}`}
              onClick={e => e.preventDefault()}
            >
              {group.private && <Lock className="w-3 h-3" />}
              {group.private ? "Request" : "View"}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Search results dropdown ─────────────────────────────────
function SearchDropdown({ results, onClose }: { results: any[]; onClose: () => void }) {
  if (!results.length) return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 p-4 text-center">
      <p className="text-sm text-muted-foreground">No groups found</p>
    </div>
  );

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
      {results.map((group: any) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <div
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors cursor-pointer border-b border-border last:border-0"
            onClick={onClose}
            data-testid={`search-result-group-${group.id}`}
          >
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary shrink-0">
              {group.coverImage
                ? <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-sm opacity-30">🏁</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{group.name}</p>
                {group.private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{(group.memberCount || 0).toLocaleString()} members</span>
                <span>·</span>
                <span>{group.category}</span>
              </div>
            </div>
            {group.private
              ? <Badge variant="outline" className="text-[10px] gap-1 shrink-0"><Lock className="w-2.5 h-2.5" />Private</Badge>
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            }
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Main GroupsPage ──────────────────────────────────────────
export default function GroupsPage() {
  useSEO({ title: "Groups", description: "Find and join WhipGuides communities for automotive, motorsports, firearms, maker and music enthusiasts." });
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeVertical, setActiveVertical] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardGroup, setWizardGroup] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [groupVertical, setGroupVertical] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // Track browsed categories for suggestions
  useEffect(() => { recordBrowse(activeCategory); }, [activeCategory]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Data fetching ──────────────────────────────────────────

  // All/filtered groups
  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", activeCategory],
    queryFn: () => {
      const url = activeCategory === "All"
        ? "/api/groups"
        : `/api/groups?category=${encodeURIComponent(activeCategory)}`;
      return apiRequest("GET", url).then(r => r.json());
    },
  });

  // Live search results
  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/search/groups", searchQuery],
    queryFn: () =>
      apiRequest("GET", `/api/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()).then(d => d.groups || []),
    enabled: searchQuery.trim().length >= 2,
  });

  // My groups (if logged in)
  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/mine"],
    queryFn: () => apiRequest("GET", "/api/groups/mine").then(r => r.json()),
    enabled: isAuthenticated,
  });

  // Suggested groups based on browsing history
  const suggestedCategories = _browsedCategories.slice(0, 3);
  const myGroupIds = myGroups.map((g: any) => g.id);
  const { data: suggestedGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/suggested", suggestedCategories.join(","), myGroupIds.join(",")],
    queryFn: () => {
      const params = new URLSearchParams();
      if (suggestedCategories.length) params.set("categories", suggestedCategories.join(","));
      if (myGroupIds.length) params.set("excludeIds", myGroupIds.join(","));
      return apiRequest("GET", `/api/groups/suggested?${params.toString()}`).then(r => r.json());
    },
    // Always fetch — will return popular groups as fallback
  });

  // ── Mutations ──────────────────────────────────────────────
  const { mutate: createGroup, isPending: creating } = useMutation({
    mutationFn: async () => {
      const vertical = groupVertical || VERTICAL_MAP[category] || "general";
      const res = await apiRequest("POST", "/api/groups", {
        name: name.trim(), description: description.trim(), category, private: isPrivate, vertical,
      });
      return res.json();
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/mine"] });
      setCreateOpen(false);
      setName(""); setDescription(""); setCategory(""); setGroupVertical(""); setIsPrivate(false);
      // Launch setup wizard
      setWizardGroup(group);
    },
    onError: (err: any) => {
      const message = err?.message || "Could not create group. Please try again.";
      toast({ title: "Couldn't create group", description: message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Description required", variant: "destructive" }); return; }
    if (!category) { toast({ title: "Category required", variant: "destructive" }); return; }
    createGroup();
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchOpen(val.trim().length >= 2);
    if (val.trim().length >= 2) recordSearch(val.trim());
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    setSearchQuery("");
    setSearchOpen(false);
    recordBrowse(cat);
  };

  // Groups not already joined, filtered from suggestions
  const suggestedNotJoined = suggestedGroups.filter((g: any) => !myGroupIds.includes(g.id)).slice(0, 6);

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
        <Button className="gap-2 shrink-0" onClick={() => {
          if (!isAuthenticated) { toast({ title: "Sign in required" }); return; }
          setCreateOpen(true);
        }} data-testid="button-create-group">
          <Plus className="w-4 h-4" /> Create Group
        </Button>
      </div>

      {/* Search bar */}
      <div ref={searchRef} className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-testid="input-group-search"
          placeholder="Search groups by name, category, or keyword..."
          className="pl-9 h-11 text-base bg-card"
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {searchOpen && (
          <SearchDropdown
            results={searchResults}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </div>

      {/* Two-column layout when logged in */}
      <div className={`flex gap-6 items-start ${isAuthenticated ? "" : ""}`}>
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Vertical filter row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {VERTICALS_ROW.map(v => (
              <button key={v} onClick={() => { setActiveVertical(v); setActiveCategory("All"); }}
                data-testid={`filter-vertical-${v.toLowerCase().replace(" ", "-")}`}
                className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${activeVertical === v ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40"}`}>
                {v}
              </button>
            ))}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                data-testid={`filter-group-category-${cat.toLowerCase()}`}
                onClick={() => handleCategoryClick(cat)}
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
              <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" /> Create Group
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(group => <GroupCard key={group.id} group={group} />)}
            </div>
          )}
        </div>

        {/* Sidebar — Your Groups + Suggested */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0">

          {/* Your Groups */}
          {isAuthenticated && myGroups.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                Your Groups
                <span className="ml-auto text-xs text-muted-foreground">{myGroups.length}</span>
              </h3>
              <div className="space-y-2">
                {myGroups.slice(0, 5).map((group: any) => (
                  <Link key={group.id} href={`/groups/${group.id}`}>
                    <div className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-secondary shrink-0">
                        {group.coverImage
                          ? <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-sm opacity-30">🏁</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{group.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(group.memberCount || 0).toLocaleString()} members</p>
                      </div>
                      {group.private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                  </Link>
                ))}
                {myGroups.length > 5 && (
                  <p className="text-xs text-primary text-center pt-1">+{myGroups.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {/* Suggested Groups */}
          {suggestedNotJoined.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                Suggested for You
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">
                {suggestedCategories.length > 0
                  ? `Based on your interest in ${suggestedCategories.slice(0, 2).join(" & ")}`
                  : "Popular groups you might like"
                }
              </p>
              <div className="space-y-2">
                {suggestedNotJoined.map((group: any) => (
                  <Link key={group.id} href={`/groups/${group.id}`}>
                    <div className="flex items-center gap-2.5 py-2 border-b border-border last:border-0 hover:opacity-80 transition-opacity cursor-pointer group">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary shrink-0">
                        {group.coverImage
                          ? <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-sm opacity-30">🏁</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{group.name}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{(group.memberCount || 0).toLocaleString()} members</span>
                          <span>·</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{group.category}</Badge>
                        </div>
                      </div>
                      {group.private
                        ? <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      }
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Discover more hint */}
          {suggestedCategories.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <BookOpen className="w-5 h-5 text-primary mx-auto mb-1.5" />
              <p className="text-xs font-medium mb-0.5">Browse by category</p>
              <p className="text-[10px] text-muted-foreground mb-2">
                You've been exploring {suggestedCategories[0]}
              </p>
              <button
                onClick={() => handleCategoryClick(suggestedCategories[0])}
                className="text-xs text-primary font-semibold hover:underline"
              >
                See all {suggestedCategories[0]} groups →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Group Setup Wizard ── */}
      {wizardGroup && (
        <GroupSetupWizard
          group={wizardGroup}
          open={!!wizardGroup}
          onClose={() => setWizardGroup(null)}
        />
      )}

      {/* ── Create Group Dialog ── */}
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
              <label className="text-sm font-medium">Vertical *</label>
              <Select onValueChange={v => { setGroupVertical(v); }} value={groupVertical}>
                <SelectTrigger data-testid="select-group-vertical">
                  <SelectValue placeholder="Select a vertical..." />
                </SelectTrigger>
                <SelectContent>
                  {["automotive","tech","music","maker","outdoors","firearms","collectibles","powersports","general"].map(v => (
                    <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1).replace("&", "& ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} data-testid="switch-group-private" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} data-testid="button-submit-create-group">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
