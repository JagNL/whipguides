import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/utils";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidersHorizontal, TrendingUp, Zap, Shield } from "lucide-react";
import { Link } from "wouter";
import type { Listing, User } from "@shared/schema";

const CATEGORIES = ["All", "Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "Boats", "Snowmobiles"];

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
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("default");

  const { data: listings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/listings", activeCategory],
    queryFn: () => apiRequest("GET", `/api/listings${activeCategory !== "All" ? `?category=${encodeURIComponent(activeCategory)}` : ""}`).then(r => r.json()),
  });

  const sorted = [...listings].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    return 0;
  });

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative bg-card border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&q=80)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-sm font-semibold tracking-wide uppercase">The Motorsports Marketplace</span>
            </div>
            <h1 className="text-display text-4xl md:text-5xl font-extrabold text-foreground mb-3 leading-none">
              Buy. Sell.<br />
              <span className="text-primary">Ride.</span>
            </h1>
            <p className="text-muted-foreground text-base mb-6 max-w-md">
              The premier marketplace for cars, trucks, ATVs, jet skis, and anything with a motor. Real sellers. Real ratings.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/sell">
                <Button size="lg" className="font-bold" data-testid="hero-cta-sell">
                  List Your Ride
                </Button>
              </Link>
              <Link href="/groups">
                <Button size="lg" variant="outline" data-testid="hero-cta-groups">
                  Browse Communities
                </Button>
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
        {/* Category filter */}
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
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${sorted.length} listings`}
            {activeCategory !== "All" && <span className="text-primary font-medium"> in {activeCategory}</span>}
          </div>
          <div className="flex items-center gap-2">
            <select
              data-testid="select-sort"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-sm bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Listings grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-semibold mb-2">No listings found</p>
            <p className="text-sm">Be the first to list in this category.</p>
            <Link href="/sell"><Button className="mt-4">List Your Ride</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
