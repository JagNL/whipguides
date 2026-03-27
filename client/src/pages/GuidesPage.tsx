import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, Plus, Heart, Eye, Clock, Wrench, BookOpen, ChevronRight,
  Car, Bike, Waves, Truck, Zap, Target,
} from "lucide-react";
import { useCfUrl } from "@/hooks/use-cf-url";
import type { Guide } from "@/../../server/storage";

const CATEGORIES = [
  { value: "Engine", icon: Zap },
  { value: "Transmission", icon: ChevronRight },
  { value: "Brakes", icon: Target },
  { value: "Suspension", icon: Car },
  { value: "Electrical", icon: Zap },
  { value: "Interior", icon: Car },
  { value: "Exterior", icon: Car },
  { value: "Maintenance", icon: Wrench },
  { value: "Performance", icon: Bike },
  { value: "Diagnostics", icon: BookOpen },
  { value: "Jet Ski", icon: Waves },
  { value: "ATV / UTV", icon: Truck },
];

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  { value: "intermediate", label: "Intermediate", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  { value: "advanced", label: "Advanced", color: "bg-red-500/15 text-red-400 border-red-500/20" },
];

function difficultyBadge(d: string) {
  const found = DIFFICULTIES.find(x => x.value === d);
  return found?.color ?? "bg-muted text-muted-foreground";
}

function vehicleString(g: Guide) {
  const year = g.vehicleYearStart === g.vehicleYearEnd
    ? g.vehicleYearStart
    : `${g.vehicleYearStart}–${g.vehicleYearEnd}`;
  return `${year} ${g.vehicleMake} ${g.vehicleModel}`;
}

function GuideCard({ guide }: { guide: Guide }) {
  const cfUrl = useCfUrl();
  const coverSrc = guide.coverImageId && cfUrl ? `${cfUrl}/${guide.coverImageId}/public` : null;

  return (
    <Link href={`/guides/${guide.id}`}>
      <div
        data-testid={`card-guide-${guide.id}`}
        className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
      >
        {/* Cover image */}
        <div className="relative h-44 bg-secondary overflow-hidden">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={guide.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          {/* Difficulty badge */}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${difficultyBadge(guide.difficulty)}`}>
              {guide.difficulty}
            </span>
          </div>
          {/* Category badge */}
          {guide.category && (
            <div className="absolute top-3 right-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-background/80 text-foreground border border-border backdrop-blur-sm">
                {guide.category}
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {guide.title}
          </h3>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {guide.description}
          </p>

          {/* Vehicle */}
          <p className="text-xs text-primary/80 font-medium mb-3 truncate">
            {vehicleString(guide)}
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {guide.timeEstimate}h
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                {guide.tools?.length ?? 0} tools
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {guide.views}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {guide.likes}
              </span>
            </div>
          </div>

          {/* Author */}
          {guide.author && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Avatar className="w-5 h-5">
                <AvatarImage src={guide.author.avatar ?? undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {guide.author.displayName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {guide.author.displayName ?? guide.author.username}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function GuideCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Skeleton className="h-44 w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2 mt-3" />
      </div>
    </div>
  );
}

export default function GuidesPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");

  const { data: guides, isLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides", { category, difficulty, search: activeSearch }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
      if (activeSearch) params.set("search", activeSearch);
      return apiRequest("GET", `/api/guides?${params.toString()}`).then(r => r.json());
    },
  });

  const handleSearch = () => setActiveSearch(search);

  const handleCreateGuide = () => {
    if (!isAuthenticated) {
      // Let Layout handle the auth modal via the nav guard
      navigate("/guides/new");
    } else {
      navigate("/guides/new");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setActiveSearch("");
    setCategory("all");
    setDifficulty("all");
  };

  const hasFilters = activeSearch || (category && category !== "all") || (difficulty && difficulty !== "all");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display text-2xl font-extrabold tracking-tight">
            Guides <span className="text-primary">&amp; How-Tos</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Community-written repair guides, mods, and maintenance walkthroughs
          </p>
        </div>
        <Button
          onClick={handleCreateGuide}
          className="gap-2 font-semibold shrink-0"
          data-testid="button-create-guide"
        >
          <Plus className="w-4 h-4" />
          Write a Guide
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-guide-search"
              placeholder="Search guides (e.g. 'oil change', 'suspension')"
              className="pl-9 bg-secondary"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Difficulty */}
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-full sm:w-44 bg-secondary" data-testid="select-difficulty">
              <SelectValue placeholder="Any difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any difficulty</SelectItem>
              {DIFFICULTIES.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44 bg-secondary" data-testid="select-category">
              <SelectValue placeholder="Any category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any category</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={handleSearch} className="gap-1.5 shrink-0" data-testid="button-search-guides">
              <Search className="w-4 h-4" />
              Search
            </Button>
            {hasFilters && (
              <Button variant="ghost" onClick={resetFilters} className="shrink-0 text-muted-foreground">
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(cat => cat === c.value ? "" : c.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                category === c.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
              data-testid={`chip-category-${c.value}`}
            >
              {c.value}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!isLoading && guides && (
        <p className="text-sm text-muted-foreground mb-4">
          {guides.length === 0
            ? "No guides found"
            : `${guides.length} guide${guides.length !== 1 ? "s" : ""}`}
          {hasFilters && " matching your filters"}
        </p>
      )}

      {/* Guides grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <GuideCardSkeleton key={i} />)}
        </div>
      ) : guides?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No guides yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {hasFilters ? "Try adjusting your filters" : "Be the first to share your knowledge"}
          </p>
          {isAuthenticated && (
            <Button onClick={() => navigate("/guides/new")} className="gap-2">
              <Plus className="w-4 h-4" />
              Write the first guide
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {guides?.map(guide => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
