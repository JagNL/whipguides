/**
 * SavedListsPage — personal saved lists + saved searches management
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ListingCard from "@/components/ListingCard";
import {
  Bookmark, Bell, BellOff, Plus, Trash2, ChevronRight,
  Heart, Search, ArrowLeft, Edit2, Check, X,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

// ── Saved Searches panel ──────────────────────────────────────
function SavedSearchesPanel() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: searches = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-searches"],
    queryFn: () => apiRequest("GET", "/api/saved-searches").then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saved-searches/${id}`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] }),
  });

  const toggleNotifyMutation = useMutation({
    mutationFn: ({ id, notify }: { id: number; notify: boolean }) =>
      apiRequest("PATCH", `/api/saved-searches/${id}`, { notify }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] }),
  });

  const applySearch = (s: any) => {
    const f = s.filters || {};
    const params = new URLSearchParams();
    if (s.query) params.set("search", s.query);
    if (f.category) params.set("category", f.category);
    navigate(`/?${params.toString()}`);
  };

  return (
    <div>
      <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-primary" /> Saved Searches
        <span className="text-xs text-muted-foreground font-normal ml-1">({searches.length})</span>
      </h2>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : searches.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium text-sm">No saved searches yet</p>
          <p className="text-xs mt-1">Save a search from the marketplace and we'll notify you of new matches.</p>
          <Link href="/"><Button variant="outline" size="sm" className="mt-3 gap-1.5"><Search className="w-3.5 h-3.5" />Browse Marketplace</Button></Link>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((s: any) => (
            <div key={s.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => toggleNotifyMutation.mutate({ id: s.id, notify: !s.notify })}
                className={`shrink-0 ${s.notify ? "text-primary" : "text-muted-foreground"}`}
                title={s.notify ? "Notifications on" : "Notifications off"}
                data-testid={`toggle-notify-${s.id}`}
              >
                {s.notify ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => applySearch(s)}>
                <p className="text-sm font-semibold hover:text-primary transition-colors">{s.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {s.query && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">"{s.query}"</span>}
                  {s.filters?.category && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{s.filters.category}</span>}
                  {s.filters?.minPrice && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">From ${s.filters.minPrice.toLocaleString()}</span>}
                  {s.filters?.maxPrice && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">To ${s.filters.maxPrice.toLocaleString()}</span>}
                  {s.filters?.make && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{s.filters.make}</span>}
                  {s.filters?.condition && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded capitalize">{s.filters.condition}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => applySearch(s)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  Search <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  data-testid={`delete-search-${s.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── List detail view ──────────────────────────────────────────
function ListDetail({ list, onBack }: { list: any; onBack: () => void }) {
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-lists", list.id, "items"],
    queryFn: () => apiRequest("GET", `/api/saved-lists/${list.id}/items`).then(r => r.json()),
  });

  const removeMutation = useMutation({
    mutationFn: (listingId: number) =>
      apiRequest("DELETE", `/api/saved-lists/${list.id}/items/${listingId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-lists", list.id, "items"] });
      toast({ title: "Removed from list" });
    },
  });

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> All Lists
      </button>

      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{list.emoji || "📋"}</span>
        <div>
          <h2 className="font-bold text-lg">{list.name}</h2>
          <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">This list is empty</p>
          <p className="text-sm mt-1">Save listings from the marketplace using the bookmark icon.</p>
          <Link href="/"><Button variant="outline" size="sm" className="mt-3">Browse Marketplace</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item: any) => item.listing && (
            <div key={item.id} className="relative">
              <ListingCard listing={item.listing} />
              <button
                onClick={() => removeMutation.mutate(item.listing.id)}
                className="absolute top-10 right-2 w-6 h-6 bg-destructive/90 text-white rounded-full flex items-center justify-center hover:bg-destructive transition-colors z-10"
                title="Remove from list"
                data-testid={`remove-from-list-${item.listing.id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main SavedListsPage ───────────────────────────────────────
export default function SavedListsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"lists" | "searches">("lists");
  const [selectedList, setSelectedList] = useState<any>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("📋");

  const { data: lists = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-lists"],
    queryFn: () => apiRequest("GET", "/api/saved-lists").then(r => r.json()),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/saved-lists", { name: newListName.trim(), emoji: newListEmoji }).then(r => r.json()),
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-lists"] });
      setCreatingList(false); setNewListName(""); setNewListEmoji("📋");
      toast({ title: `"${list.name}" created` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saved-lists/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-lists"] });
      toast({ title: "List deleted" });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h2 className="text-display text-2xl font-extrabold mb-2">Saved Lists</h2>
        <p className="text-muted-foreground mb-6">Sign in to save listings and create personal watchlists.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  if (selectedList) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ListDetail list={selectedList} onBack={() => setSelectedList(null)} />
      </div>
    );
  }

  const EMOJIS = ["❤️", "⭐", "🔥", "🚗", "🛻", "🏍️", "🚤", "📋", "🎯", "💰", "🏆", "✅"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-2xl font-extrabold">Saved</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your watchlists, saved listings, and search alerts</p>
        </div>
        <Link href="/"><Button variant="outline" size="sm" className="gap-1.5"><Search className="w-3.5 h-3.5" />Browse</Button></Link>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-secondary rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab("lists")}
          className={`flex-1 py-1.5 text-sm font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${activeTab === "lists" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <Bookmark className="w-3.5 h-3.5" /> My Lists
        </button>
        <button
          onClick={() => setActiveTab("searches")}
          className={`flex-1 py-1.5 text-sm font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${activeTab === "searches" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <Bell className="w-3.5 h-3.5" /> Search Alerts
        </button>
      </div>

      {activeTab === "searches" ? (
        <SavedSearchesPanel />
      ) : (
        <div>
          {/* Lists grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {lists.map((list: any) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left group"
                  data-testid={`list-card-${list.id}`}
                >
                  <span className="text-2xl">{list.emoji || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{list.name}</p>
                      {list.is_default && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full shrink-0">Default</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{list.itemCount ?? 0} items</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    {!list.is_default && (
                      <button
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(list.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                        data-testid={`delete-list-${list.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create new list */}
          {creatingList ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">New List</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setNewListEmoji(e)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${newListEmoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"}`}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="List name..."
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) createMutation.mutate(); if (e.key === "Escape") setCreatingList(false); }}
                  className="bg-secondary"
                />
                <Button onClick={() => createMutation.mutate()} disabled={!newListName.trim() || createMutation.isPending} size="sm" className="gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreatingList(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreatingList(true)} className="gap-2 w-full" data-testid="button-create-list">
              <Plus className="w-4 h-4" /> Create New List
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
