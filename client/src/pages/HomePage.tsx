import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ListingCard from "@/components/ListingCard";
import AdCard, { injectAdsIntoFeed } from "@/components/AdCard";
import LocationPicker from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal, TrendingUp, Zap, Shield, Search, X, MapPin,
  DollarSign, Bell, BellOff, BookmarkPlus, Clock, Sparkles, ChevronRight,
  Star, RotateCcw, Save, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Listing } from "@shared/schema";

// ── Feed with injected ads ───────────────────────────────────
function FeedWithAds({ listings }: { listings: any[] }) {
  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["/api/ads/serve", "marketplace"],
    queryFn: () => apiRequest("GET", "/api/ads/serve?context=marketplace&limit=3").then(r => r.json()),
    staleTime: 60_000,
  });
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const activeAds = ads.filter((a: any) => !dismissedIds.includes(a.id));
  const feed = injectAdsIntoFeed(listings, activeAds, 8);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {feed.map((item: any, i) => {
        if (item.__isAd) {
          return <AdCard key={`ad-${item.ad.id}`} ad={item.ad} compact onDismiss={() => setDismissedIds(d => [...d, item.ad.id])} />;
        }
        return <ListingCard key={(item as any).id} listing={item as any} />;
      })}
    </div>
  );
}

// ── Session ID for anonymous tracking ────────────────────────
let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) _sessionId = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  return _sessionId;
}

const CATEGORIES = [
  "All",
  // Vehicles
  "Cars", "Trucks", "SUVs & Crossovers", "Motorcycles", "ATVs",
  "UTVs / Side-by-Sides", "Dirt Bikes", "Jet Skis / PWC", "Boats",
  "Snowmobiles", "RVs & Campers", "Classic & Antique Vehicles",
  // Parts
  "Parts & Accessories", "Engine & Drivetrain", "Body & Exterior",
  "Wheels & Tires", "Performance Parts",
  // General
  "Furniture & Home", "Electronics & Gadgets", "Collectibles & Antiques",
  "Firearms & Hunting", "Sporting Goods", "Tools & Equipment", "Other",
];
const CONDITIONS = ["Any", "New", "Like New", "Excellent", "Good", "Fair"];
const SORT_OPTIONS = [
  { value: "default", label: "Featured First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest First" },
  { value: "mileage_asc", label: "Lowest Mileage" },
];

const DATE_POSTED_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i));

// ── Saved Search Banner ───────────────────────────────────────
function SaveSearchBanner({ filters, onSave }: { filters: any; onSave: () => void }) {
  const hasFilters = filters.q || filters.category !== "All" || filters.condition !== "any" ||
    filters.minPrice || filters.maxPrice || filters.make || filters.model ||
    filters.minYear || filters.maxYear;
  if (!hasFilters) return null;
  return (
    <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2 mb-3 text-sm">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <span className="text-muted-foreground flex-1">Save this search and get notified of new matches</span>
      <Button size="sm" variant="outline" onClick={onSave} className="gap-1.5 shrink-0 h-7 text-xs">
        <Save className="w-3 h-3" /> Save Search
      </Button>
    </div>
  );
}

// ── Listing grid skeleton ─────────────────────────────────────
function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal listing scroll ─────────────────────────────────
function ListingRow({ listings, emptyText }: { listings: any[]; emptyText?: string }) {
  if (!listings.length) return emptyText ? (
    <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
  ) : null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
      {listings.map(l => (
        <div key={l.id} className="w-52 shrink-0">
          <ListingCard listing={l} compact />
        </div>
      ))}
    </div>
  );
}

// ── Save Search Modal ─────────────────────────────────────────
function SaveSearchModal({ filters, onClose, onSaved }: { filters: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(() => {
    const parts = [];
    if (filters.q) parts.push(filters.q);
    if (filters.category && filters.category !== "All") parts.push(filters.category);
    if (filters.make) parts.push(filters.make);
    return parts.join(" ") || "My search";
  });
  const [notify, setNotify] = useState(true);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/saved-searches", {
      name: name.trim(),
      query: filters.q || "",
      filters: {
        category: filters.category !== "All" ? filters.category : undefined,
        condition: filters.condition !== "any" ? filters.condition : undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        make: filters.make || undefined,
        model: filters.model || undefined,
        minYear: filters.minYear || undefined,
        maxYear: filters.maxYear || undefined,
        location: filters.locationFilter || undefined,
      },
      notify,
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Search saved!", description: notify ? "You'll be notified of new matches." : "Saved without notifications." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't save search", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Save This Search
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Search name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-secondary" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setNotify(n => !n)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${notify ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${notify ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Notify me</p>
              <p className="text-xs text-muted-foreground">Get notified when new matching listings appear</p>
            </div>
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()} className="flex-1 gap-1.5">
            <Bell className="w-3.5 h-3.5" /> {saveMutation.isPending ? "Saving..." : "Save & Watch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main HomePage ─────────────────────────────────────────────
export default function HomePage() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");

  const [search, setSearch] = useState(urlParams.get("search") || "");
  const [activeSearch, setActiveSearch] = useState(urlParams.get("search") || "");
  const [activeCategory, setActiveCategory] = useState("All");
  const [condition, setCondition] = useState("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [searchLat, setSearchLat] = useState<number | undefined>();
  const [searchLng, setSearchLng] = useState<number | undefined>();
  const [radiusMiles, setRadiusMiles] = useState("any");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [minMileage, setMinMileage] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "foryou" | "recent">("browse");

  const hasActiveFilters = activeSearch || activeCategory !== "All" || condition !== "any" ||
    minPrice || maxPrice || locationFilter || make || model || minYear || maxYear || minMileage || maxMileage || radiusMiles !== "any";

  const currentFilters = { q: activeSearch, category: activeCategory, condition, minPrice, maxPrice, locationFilter, make, model, minYear, maxYear, radiusMiles };

  // ── Browse listings ──
  const [activeSearchLat, setActiveSearchLat] = useState<number | undefined>();
  const [activeSearchLng, setActiveSearchLng] = useState<number | undefined>();
  const [activeRadius, setActiveRadius] = useState("any");

  const { data: listings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/search/listings", { q: activeSearch, activeCategory, condition, minPrice, maxPrice, locationFilter, make, model, minYear, maxYear, minMileage, maxMileage, sortBy, activeSearchLat, activeSearchLng, activeRadius }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeSearch) params.set("q", activeSearch);
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (condition !== "any") params.set("condition", condition);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (locationFilter) params.set("location", locationFilter);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (minYear) params.set("minYear", minYear);
      if (maxYear) params.set("maxYear", maxYear);
      if (minMileage) params.set("minMileage", minMileage);
      if (maxMileage) params.set("maxMileage", maxMileage);
      if (sortBy !== "default") params.set("sort", sortBy);
      if (activeSearchLat !== undefined) params.set("searchLat", String(activeSearchLat));
      if (activeSearchLng !== undefined) params.set("searchLng", String(activeSearchLng));
      if (activeRadius && activeRadius !== "any") params.set("radiusMiles", activeRadius);
      if (datePosted !== "any") params.set("datePosted", datePosted);
      return apiRequest("GET", `/api/search/listings?${params.toString()}`).then(r => r.json());
    },
  });

  // ── For You recommendations ──
  const sessionId = getSessionId();
  const { data: recommendations = [] } = useQuery<any[]>({
    queryKey: ["/api/recommendations", sessionId],
    queryFn: () => apiRequest("GET", "/api/recommendations", undefined).then(r => r.json()),
    enabled: activeTab === "foryou",
  });

  // ── Recently viewed ──
  const { data: recentlyViewed = [] } = useQuery<any[]>({
    queryKey: ["/api/recently-viewed", sessionId],
    queryFn: () => apiRequest("GET", "/api/recently-viewed", undefined).then(r => r.json()),
    enabled: true, // always fetch — self-referencing in enabled caused TDZ crash
  });

  // ── Saved searches ──
  const { data: savedSearches = [] } = useQuery<any[]>({
    queryKey: ["/api/saved-searches"],
    queryFn: () => apiRequest("GET", "/api/saved-searches").then(r => r.json()),
    enabled: isAuthenticated,
  });

  const deleteSearchMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saved-searches/${id}`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] }),
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActiveSearch(search.trim());
  };

  const resetFilters = () => {
    setSearch(""); setActiveSearch(""); setActiveCategory("All");
    setCondition("any"); setMinPrice(""); setMaxPrice(""); setLocationFilter("");
    setSearchLat(undefined); setSearchLng(undefined); setRadiusMiles("any");
    setActiveSearchLat(undefined); setActiveSearchLng(undefined); setActiveRadius("any");
    setMake(""); setModel(""); setMinYear(""); setMaxYear("");
    setMinMileage(""); setMaxMileage(""); setSortBy("default"); setDatePosted("any");
  };

  const applySearch = (s: any) => {
    const f = s.filters || {};
    setActiveSearch(s.query || ""); setSearch(s.query || "");
    setActiveCategory(f.category || "All");
    setCondition(f.condition || "any");
    setMinPrice(f.minPrice?.toString() || "");
    setMaxPrice(f.maxPrice?.toString() || "");
    setMake(f.make || ""); setModel(f.model || "");
    setMinYear(f.minYear?.toString() || ""); setMaxYear(f.maxYear?.toString() || "");
    setLocationFilter(f.location || "");
    setActiveTab("browse");
    toast({ title: `Applied "${s.name}"` });
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative bg-card border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&q=80)" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-sm font-semibold tracking-wide uppercase">The Motorsports Marketplace</span>
            </div>
            <h1 className="text-display text-4xl md:text-5xl font-extrabold text-foreground mb-4 leading-none">
              Buy. Sell.<br /><span className="text-primary">Ride.</span>
            </h1>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-hero-search"
                  placeholder="Search make, model, category..."
                  className="pl-9 h-11 bg-card/90 border-border text-base"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(""); setActiveSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Button type="submit" size="lg" className="h-11 font-bold">Search</Button>
            </form>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/sell"><Button variant="outline" size="sm">List Your Ride</Button></Link>
              <Link href="/groups"><Button variant="ghost" size="sm">Browse Communities</Button></Link>
              {isAuthenticated && (
                <Link href="/saved">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5" /> Saved Lists
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="relative border-t border-border bg-card/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8 overflow-x-auto">
            {[{ icon: TrendingUp, value: "12,400+", label: "Active Listings" }, { icon: Zap, value: "4,800+", label: "Transactions" }, { icon: Shield, value: "9,200+", label: "Verified Users" }].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <Icon className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">{value}</span>
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Saved searches bar */}
        {isAuthenticated && savedSearches.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Searches</span>
              <Link href="/saved">
                <span className="text-xs text-primary ml-auto hover:underline cursor-pointer">Manage</span>
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {savedSearches.slice(0, 6).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => applySearch(s)}
                  className="flex items-center gap-1.5 shrink-0 text-xs px-3 py-1.5 rounded-full bg-secondary border border-border hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid={`saved-search-${s.id}`}
                >
                  {s.notify ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3 text-muted-foreground" />}
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar: Browse / For You / Recently Viewed */}
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {[
            { key: "browse", label: "Browse", icon: Search },
            { key: "foryou", label: "For You", icon: Sparkles },
            { key: "recent", label: "Recently Viewed", icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── For You tab ── */}
        {activeTab === "foryou" && (
          <div>
            {recommendations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No recommendations yet</p>
                <p className="text-sm mt-1">Browse some listings and we'll start personalizing your feed.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>Browse Marketplace</Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Personalized based on what you've viewed
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recommendations.map((l: any) => <ListingCard key={l.id} listing={l} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Recently Viewed tab ── */}
        {activeTab === "recent" && (
          <div>
            {recentlyViewed.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">Nothing viewed yet</p>
                <p className="text-sm mt-1">Listings you view will appear here.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>Start Browsing</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentlyViewed.map((l: any) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Browse tab ── */}
        {activeTab === "browse" && (
          <>
            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button key={cat}
                  data-testid={`filter-category-${cat.toLowerCase().replace(" ", "-")}`}
                  onClick={() => setActiveCategory(cat)}
                  className={`category-pill shrink-0 border ${activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >{cat}</button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="text-sm text-muted-foreground flex-1">
                {isLoading ? "Searching..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""}`}
                {activeSearch && <span className="text-foreground font-medium"> for "{activeSearch}"</span>}
                {activeCategory !== "All" && <span className="text-primary font-medium"> in {activeCategory}</span>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)}
                className={`gap-1.5 ${showFilters ? "border-primary text-primary" : ""}`}
                data-testid="button-toggle-filters">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </Button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 h-8 text-sm bg-secondary" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground gap-1" data-testid="button-reset-filters">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </Button>
              )}
            </div>

            {/* Save search banner */}
            {isAuthenticated && (
              <SaveSearchBanner filters={currentFilters} onSave={() => setSaveSearchOpen(true)} />
            )}

            {/* Advanced filters */}
            {showFilters && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Condition</label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Date Posted
                    </label>
                    <Select value={datePosted} onValueChange={setDatePosted}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATE_POSTED_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Make</label>
                    <Input placeholder="e.g. Ford" value={make} onChange={e => setMake(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Model</label>
                    <Input placeholder="e.g. F-150" value={model} onChange={e => setModel(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Near location
                    </label>
                    <LocationPicker
                      value={locationFilter}
                      onChange={(display, coords) => {
                        setLocationFilter(display);
                        setSearchLat(coords?.lat);
                        setSearchLng(coords?.lng);
                      }}
                      placeholder="City, state or ZIP"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Radius
                    </label>
                    <Select value={radiusMiles} onValueChange={setRadiusMiles} disabled={!searchLat}>
                      <SelectTrigger className="h-8 text-sm bg-secondary">
                        <SelectValue placeholder={searchLat ? "Any distance" : "Set location first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any distance</SelectItem>
                        <SelectItem value="10">Within 10 mi</SelectItem>
                        <SelectItem value="25">Within 25 mi</SelectItem>
                        <SelectItem value="50">Within 50 mi</SelectItem>
                        <SelectItem value="100">Within 100 mi</SelectItem>
                        <SelectItem value="250">Within 250 mi</SelectItem>
                        <SelectItem value="500">Within 500 mi</SelectItem>
                      </SelectContent>
                    </Select>
                    {searchLat && radiusMiles !== "any" && (
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> Location pinned
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />Min Price</label>
                    <Input type="number" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />Max Price</label>
                    <Input type="number" placeholder="Any" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Year From</label>
                    <Select value={minYear} onValueChange={setMinYear}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Year To</label>
                    <Select value={maxYear} onValueChange={setMaxYear}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Max Mileage</label>
                    <Input type="number" placeholder="e.g. 50000" value={maxMileage} onChange={e => setMaxMileage(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => {
                    handleSearch();
                    setActiveSearchLat(searchLat);
                    setActiveSearchLng(searchLng);
                    setActiveRadius(radiusMiles);
                  }} className="gap-1.5">
                    <Search className="w-3.5 h-3.5" /> Apply Filters
                  </Button>
                </div>
              </div>
            )}

            {/* Listings grid */}
            {isLoading ? <ListingGridSkeleton /> :
              listings.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-semibold mb-1">No listings found</p>
                  <p className="text-sm">{hasActiveFilters ? "Try adjusting your search or filters." : "Be the first to list in this category."}</p>
                  {hasActiveFilters && <Button variant="outline" className="mt-4" onClick={resetFilters}>Clear filters</Button>}
                  {!hasActiveFilters && <Link href="/sell"><Button className="mt-4">List Your Ride</Button></Link>}
                </div>
              ) : (
<FeedWithAds listings={listings} />
              )
            }
          </>
        )}
      </div>

      {/* Save search modal */}
      {saveSearchOpen && (
        <SaveSearchModal
          filters={currentFilters}
          onClose={() => setSaveSearchOpen(false)}
          onSaved={() => setSaveSearchOpen(false)}
        />
      )}
    </div>
  );
}
