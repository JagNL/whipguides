import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { BusinessCard } from "@/components/BusinessCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  Building2,
  SlidersHorizontal,
  X,
} from "lucide-react";

const CATEGORIES = [
  "All",
  "Dealership",
  "Auto Repair",
  "Parts Supplier",
  "Motorsports Shop",
  "Custom Shop",
  "Towing",
  "Detailing",
  "Rental",
  "Firearms Dealer",
  "Marine",
  "General",
];

export function BusinessesPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/business", search, category, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("q", search);
      if (category !== "All") params.set("category", category);
      const res = await apiRequest("GET", `/api/business?${params}`);
      return res.json();
    },
  });

  const pages: any[] = data?.pages || [];
  const total: number = data?.total || 0;

  const handleSearch = () => {
    setSearch(q);
    setPage(1);
  };

  const clearSearch = () => {
    setQ("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Business Pages</h1>
          <p className="text-white/50 text-sm mt-0.5">Discover dealerships, repair shops, and more</p>
        </div>
        {user && (
          <Button
            data-testid="btn-create-business-page"
            onClick={() => navigate("/business/new")}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Create Page
          </Button>
        )}
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            data-testid="input-business-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search businesses by name…"
            className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
          {q && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          data-testid="btn-search-businesses"
          onClick={handleSearch}
          className="bg-orange-500 hover:bg-orange-600 text-white"
          size="icon"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            data-testid={`filter-category-${cat}`}
            onClick={() => { setCategory(cat); setPage(1); }}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === cat
                ? "bg-orange-500 border-orange-500 text-white font-medium"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-white/40 mb-4">
          {total.toLocaleString()} business{total !== 1 ? "es" : ""}{search ? ` matching "${search}"` : ""}
          {category !== "All" ? ` in ${category}` : ""}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : pages.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(p => <BusinessCard key={p.id} page={p} />)}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="border-white/15 text-white/70 hover:text-white"
              >
                Previous
              </Button>
              <span className="text-sm text-white/50">Page {page} of {Math.ceil(total / 20)}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
                className="border-white/15 text-white/70 hover:text-white"
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/60 font-medium mb-1">No businesses found</p>
          <p className="text-white/30 text-sm mb-6">
            {search || category !== "All"
              ? "Try adjusting your search or filters"
              : "Be the first to create a business page"}
          </p>
          {user && (
            <Button
              onClick={() => navigate("/business/new")}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" /> Create Business Page
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
