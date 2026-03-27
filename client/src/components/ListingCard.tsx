import { Link } from "wouter";
import { Heart, Eye, MapPin, ShieldCheck, Star, BookmarkPlus, Check, ChevronDown } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { timeAgo, formatPrice } from "@/lib/utils";

interface ListingCardProps {
  listing: any;
  compact?: boolean;
}

const CONDITION_STYLES: Record<string, string> = {
  "New":       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Like New":  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Excellent": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Good":      "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Fair":      "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Cars": "🚗", "Trucks": "🛻", "ATVs": "🏍️", "Jet Skis": "🚤",
  "Motorcycles": "🏍️", "Boats": "⛵", "Snowmobiles": "🏔️",
  "UTVs": "🚙", "Dirt Bikes": "🏁", "Firearms": "🎯", "Antiques": "🏺",
};

// ── Save to List dropdown ─────────────────────────────────────
function SaveToListDropdown({ listingId, onClose }: { listingId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newListName, setNewListName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: lists = [] } = useQuery<any[]>({
    queryKey: ["/api/saved-lists"],
    queryFn: () => apiRequest("GET", "/api/saved-lists").then(r => r.json()),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addMutation = useMutation({
    mutationFn: (listId: number) =>
      apiRequest("POST", `/api/saved-lists/${listId}/items`, { listingId }).then(r => r.json()),
    onSuccess: (_, listId) => {
      const list = lists.find(l => l.id === listId);
      toast({ title: `Added to ${list?.name || "list"}` });
      qc.invalidateQueries({ queryKey: ["/api/saved-lists"] });
      onClose();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const list = await apiRequest("POST", "/api/saved-lists", { name: newListName.trim(), emoji: "📋" }).then(r => r.json());
      await apiRequest("POST", `/api/saved-lists/${list.id}/items`, { listingId }).then(r => r.json());
      return list;
    },
    onSuccess: (list) => {
      toast({ title: `Added to "${list.name}"` });
      qc.invalidateQueries({ queryKey: ["/api/saved-lists"] });
      onClose();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div ref={ref} className="absolute top-full right-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground">Save to list</p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {lists.map(list => (
          <button key={list.id} onClick={() => addMutation.mutate(list.id)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-sm text-left">
            <span>{list.emoji || "📋"}</span>
            <span className="flex-1 truncate">{list.name}</span>
            {list.is_default && <span className="text-[10px] text-primary">Watchlist</span>}
          </button>
        ))}
        {lists.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No lists yet</p>
        )}
      </div>
      <div className="border-t border-border px-3 py-2">
        {creatingNew ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              placeholder="List name..."
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newListName.trim()) createAndAddMutation.mutate();
                if (e.key === "Escape") setCreatingNew(false);
              }}
            />
            <button
              onClick={() => newListName.trim() && createAndAddMutation.mutate()}
              disabled={!newListName.trim() || createAndAddMutation.isPending}
              className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors"
            >
              {createAndAddMutation.isPending ? "..." : "Add"}
            </button>
          </div>
        ) : (
          <button onClick={() => setCreatingNew(true)} className="text-xs text-primary hover:underline w-full text-left">
            + Create new list
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ListingCard ──────────────────────────────────────────
export default function ListingCard({ listing, compact = false }: ListingCardProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);

  // Watchlist status
  const { data: savedStatus } = useQuery<{ saved: boolean; lists: number[] }>({
    queryKey: ["/api/listings", listing.id, "saved-status"],
    queryFn: () => apiRequest("GET", `/api/listings/${listing.id}/saved-status`).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const isSaved = optimisticSaved !== null ? optimisticSaved : savedStatus?.saved ?? false;

  const watchlistMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/watchlist/toggle", { listingId: listing.id }).then(r => r.json()),
    onMutate: () => setOptimisticSaved(s => !s),
    onSuccess: (data) => {
      setOptimisticSaved(data.saved);
      qc.invalidateQueries({ queryKey: ["/api/listings", listing.id, "saved-status"] });
      if (data.saved) toast({ title: "Added to Watchlist" });
    },
    onError: () => {
      setOptimisticSaved(null);
      toast({ title: "Sign in to save listings" });
    },
  });

  const img = listing.images?.[0]
    ? (listing.images[0].startsWith("http") ? listing.images[0] : null)
    : "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80";

  if (compact) {
    return (
      <Link href={`/listing/${listing.id}`}>
        <div className="bg-card rounded-lg border border-border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group" data-testid={`card-listing-compact-${listing.id}`}>
          <div className="aspect-[4/3] overflow-hidden bg-secondary">
            {img && <img src={img} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />}
          </div>
          <div className="p-2">
            <p className="font-bold text-sm text-primary">{formatPrice(listing.price)}</p>
            <p className="text-xs font-medium line-clamp-1">{listing.title}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <MapPin className="w-2.5 h-2.5" /> {listing.location}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="listing-card group" data-testid={`card-listing-${listing.id}`}>
      {/* Image */}
      <Link href={`/listing/${listing.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {img && <img src={img} alt={listing.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />}
          {listing.featured && (
            <div className="absolute top-2 left-2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">FEATURED</span>
            </div>
          )}
          <div className="absolute top-2 right-10">
            <span className="bg-background/80 backdrop-blur-sm text-xs font-medium px-2 py-0.5 rounded-full border border-border">
              {CATEGORY_ICONS[listing.category] || "🔧"} {listing.category}
            </span>
          </div>
        </div>
      </Link>

      {/* Content */}
      <Link href={`/listing/${listing.id}`}>
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xl font-extrabold text-display text-foreground">{formatPrice(listing.price)}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${CONDITION_STYLES[listing.condition] || ""}`}>
              {listing.condition}
            </Badge>
          </div>
          <p className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">{listing.title}</p>
          {(listing.year || listing.make || listing.model) && (
            <p className="text-xs text-muted-foreground">
              {[listing.year, listing.make, listing.model].filter(Boolean).join(" ")}
              {listing.mileage && ` · ${listing.mileage.toLocaleString()} mi`}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{listing.location}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {listing.views || 0}</span>
              <span>·</span>
              <span>{listing.createdAt ? timeAgo(listing.createdAt) : ""}</span>
            </div>
          </div>
          {listing.seller && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <img src={listing.seller.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listing.seller.username}`}
                alt={listing.seller.displayName} className="w-5 h-5 rounded-full object-cover" />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {listing.seller.displayName}
                {listing.seller.verified && <ShieldCheck className="w-3 h-3 text-primary" />}
              </span>
              {listing.seller.rating > 0 && (
                <span className="ml-auto text-xs flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {Number(listing.seller.rating).toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* Report button (bottom of card, only for logged-in non-sellers) */}
      <div className="absolute bottom-2 left-2">
        <ReportButton targetType="listing" targetId={listing.id} iconOnly />
      </div>

      {/* Action buttons overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {/* Heart / Watchlist */}
        <button
          data-testid={`button-save-${listing.id}`}
          onClick={e => {
            e.preventDefault();
            if (!isAuthenticated) { toast({ title: "Sign in to save listings" }); return; }
            watchlistMutation.mutate();
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm border border-border hover:border-primary transition-all"
        >
          <Heart className={`w-3.5 h-3.5 transition-colors ${isSaved ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>

        {/* Add to list */}
        {isAuthenticated && (
          <div className="relative">
            <button
              data-testid={`button-add-list-${listing.id}`}
              onClick={e => { e.preventDefault(); setShowListDropdown(s => !s); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm border border-border hover:border-primary transition-all"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {showListDropdown && (
              <SaveToListDropdown
                listingId={listing.id}
                onClose={() => setShowListDropdown(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
