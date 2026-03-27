import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, TrendingUp, Zap, Shield, Search, X, MapPin, DollarSign } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Listing } from "@shared/schema";

const CATEGORIES = ["All", "Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "Boats", "Snowmobiles", "UTVs", "Dirt Bikes", "Firearms", "Antiques"];
const CONDITIONS = ["Any", "New", "Like New", "Excellent", "Good", "Fair"];
const SORT_OPTIONS = [
  { value: "default", label: "Featured First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
];

const HERO_STATS = [
  { icon: TrendingUp, value: "12,400+", label: "Active Listings" },
  { icon: Zap, value: "4,800+", label: "Transactions" },
  { icon: Shield, value: "9,200+", label: "Verified Users" },
];

export default function HomePage() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");

  const [search, setSearch] = useState(urlParams.get("search") || "");
  const [activeSearch, setActiveSearch] = useState(urlParams.get("search") || "");
  const [activeCategory, setActiveCategory] = useState("All");
  const [condition, setCondition] = useState("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = activeSearch || activeCategory !== "All" || condition !== "any" || minPrice || maxPrice || locationFilter;

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/search/listings", { q: activeSearch, activeCategory, condition, minPrice, maxPrice, locationFilter, sortBy }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeSearch) params.set("q", activeSearch);
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (condition !== "any") params.set("condition", condition);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (locationFilter) params.set("location", locationFilter);
      if (sortBy !== "default") params.set("sort", sortBy);
      return apiRequest("GET", `/api/search/listings?${params.toString()}`).then(r => r.json());
    },
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActiveSearch(search.trim());
  };

  const resetFilters = () => {
    setSearch(""); setActiveSearch(""); setActiveCategory("All");
    setCondition("any"); setMinPrice(""); setMaxPrice(""); setLocationFilter("");
    setSortBy("default");
  };

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative bg-card border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&q=80)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-sm font-semibold tracking-wide uppercase">The Motorsports Marketplace</span>
            </div>
            <h1 className="text-display text-4xl md:text-5xl font-extrabold text-foreground mb-4 leading-none">
              Buy. Sell.<br />
              <span className="text-primary">Ride.</span>
            </h1>

            {/* Hero search bar */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-hero-search"
                  placeholder="Search by make, model, category..."
                  className="pl-9 h-11 bg-card/90 border-border text-base"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(""); setActiveSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <Button type="submit" size="lg" className="h-11 font-bold" data-testid="button-hero-search">
                Search
              </Button>
            </form>

            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/sell">
                <Button variant="outline" size="sm" data-testid="hero-cta-sell">List Your Ride</Button>
              </Link>
              <Link href="/groups">
                <Button variant="ghost" size="sm" data-testid="hero-cta-groups">Browse Communities</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-border bg-card/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8 overflow-x-auto">
            {HERO_STATS.map(({ icon: Icon, value, label }) => (
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
        {/* Category pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              data-testid={`filter-category-${cat.toLowerCase().replace(" ", "-")}`}
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

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="text-sm text-muted-foreground flex-1">
            {isLoading ? "Searching..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""}`}
            {activeSearch && <span className="text-foreground font-medium"> for "{activeSearch}"</span>}
            {activeCategory !== "All" && <span className="text-primary font-medium"> in {activeCategory}</span>}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(f => !f)}
            className={`gap-1.5 ${showFilters ? "border-primary text-primary" : ""}`}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
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
              <X className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="h-8 text-sm bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Min Price
              </label>
              <Input
                data-testid="input-min-price"
                type="number"
                placeholder="0"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="h-8 text-sm bg-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Max Price
              </label>
              <Input
                data-testid="input-max-price"
                type="number"
                placeholder="Any"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="h-8 text-sm bg-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location
              </label>
              <Input
                data-testid="input-location-filter"
                placeholder="City or state"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="h-8 text-sm bg-secondary"
              />
            </div>
          </div>
        )}

        {/* Listings grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
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
        ) : listings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-semibold mb-1">No listings found</p>
            <p className="text-sm">
              {hasActiveFilters ? "Try adjusting your search or filters." : "Be the first to list in this category."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={resetFilters}>Clear filters</Button>
            )}
            {!hasActiveFilters && (
              <Link href="/sell"><Button className="mt-4">List Your Ride</Button></Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
