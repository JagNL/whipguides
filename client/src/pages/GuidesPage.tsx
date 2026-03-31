import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, Plus, Heart, Eye, Clock, Wrench, BookOpen, ChevronRight,
  Car, Waves, Target, Music2, Cpu, Trophy, CheckCircle2, BarChart2,
  Star, Users,
} from "lucide-react";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import type { Guide } from "@/../../server/storage";
import { GUIDE_VERTICALS } from "@/lib/guide-verticals";
import { guideUrl } from "@/lib/utils";

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  { value: "intermediate", label: "Intermediate", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  { value: "advanced", label: "Advanced", color: "bg-red-500/15 text-red-400 border-red-500/20" },
];

const VERTICAL_ICONS: Record<string, React.ElementType> = {
  Car, Waves, Target, Music2, Cpu, Trophy, Wrench,
};

function difficultyBadge(d: string) {
  return DIFFICULTIES.find(x => x.value === d)?.color ?? "bg-muted text-muted-foreground";
}

function VerticalBadge({ vertical }: { vertical?: string }) {
  if (!vertical) return null;
  const v = GUIDE_VERTICALS.find(x => x.key === vertical);
  if (!v) return null;
  const Icon = VERTICAL_ICONS[v.icon] ?? Wrench;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
      <Icon className="w-2.5 h-2.5" /> {v.label}
    </span>
  );
}

function QualityBadge({ score, verified }: { score?: number; verified?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {verified && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
        </span>
      )}
      {score !== undefined && score > 70 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          <BarChart2 className="w-2.5 h-2.5" /> {score}
        </span>
      )}
    </div>
  );
}

function GuideCard({ guide }: { guide: any }) {
  const cfUrl = useCfUrl();
  const coverSrc = cfImageUrl(cfUrl, guide.coverImageId);

  return (
    <Link href={guideUrl(guide.id, guide.title)}>
      <div
        data-testid={`card-guide-${guide.id}`}
        className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
      >
        <div className="relative h-44 bg-secondary overflow-hidden">
          {coverSrc ? (
            <img src={coverSrc} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${difficultyBadge(guide.difficulty)}`}>
              {guide.difficulty}
            </span>
          </div>
          {guide.category && (
            <div className="absolute top-3 right-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-background/80 text-foreground border border-border backdrop-blur-sm">
                {guide.category}
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1">
              {guide.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <VerticalBadge vertical={guide.vertical} />
            <QualityBadge score={(guide as any).qualityScore} verified={(guide as any).communityVerified} />
          </div>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{guide.description}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{guide.timeEstimate}h</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{guide.views}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{guide.likes}</span>
            </div>
          </div>
          {guide.author && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Avatar className="w-5 h-5">
                <AvatarImage src={guide.author.avatar ?? undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {guide.author.displayName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">{guide.author.displayName ?? guide.author.username}</span>
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

function SeriesCard({ series }: { series: any }) {
  const cfUrl = useCfUrl();
  const cover = cfImageUrl(cfUrl, series.coverImageId);
  return (
    <Link href={`/guide-series/${series.id}`}>
      <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer flex gap-4 p-4">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary shrink-0">
          {cover ? <img src={cover} alt={series.title} className="w-full h-full object-cover" /> : <BookOpen className="w-6 h-6 text-muted-foreground/30 m-auto mt-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">{series.title}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {series.guideCount ?? 0} guides</span>
            {series.author && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{series.author.displayName ?? series.author.username}</span>}
          </div>
          <Button size="sm" variant="outline" className="mt-2 h-6 text-xs px-2">View Series</Button>
        </div>
      </div>
    </Link>
  );
}

export default function GuidesPage() {
  useSEO({ title: "How-To Guides", description: "Explore community-created automotive, motorsports, and maker how-to guides on WhipGuides." });
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [vertical, setVertical] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("quality");

  const activeVertical = GUIDE_VERTICALS.find(v => v.key === vertical);
  const categoryOptions = activeVertical?.categories ?? [];

  const { data: guides, isLoading } = useQuery<any[]>({
    queryKey: ["/api/guides", { vertical, category, difficulty, search: activeSearch, sortBy }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (vertical) params.set("vertical", vertical);
      if (category && category !== "all") params.set("category", category);
      if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
      if (activeSearch) params.set("search", activeSearch);
      if (sortBy) params.set("sortBy", sortBy);
      return apiRequest("GET", `/api/guides?${params.toString()}`).then(r => r.json());
    },
  });

  const { data: seriesList } = useQuery<any[]>({
    queryKey: ["/api/guide-series", { vertical }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (vertical) params.set("vertical", vertical);
      return apiRequest("GET", `/api/guide-series?${params.toString()}`).then(r => r.json());
    },
  });

  const handleSearch = () => setActiveSearch(search);
  const hasFilters = activeSearch || vertical || (category && category !== "all") || (difficulty && difficulty !== "all");

  const resetFilters = () => {
    setSearch(""); setActiveSearch(""); setVertical(""); setCategory(""); setDifficulty("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display text-2xl font-extrabold tracking-tight">
            Guides <span className="text-primary">&amp; How-Tos</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Community-written repair guides, mods, and maintenance walkthroughs</p>
        </div>
        <Button onClick={() => navigate("/guides/new")} className="gap-2 font-semibold shrink-0" data-testid="button-create-guide">
          <Plus className="w-4 h-4" /> Write a Guide
        </Button>
      </div>

      {/* Vertical filter row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setVertical(""); setCategory(""); }}
          data-testid="chip-vertical-all"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
            !vertical ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
          }`}
        >
          All
        </button>
        {GUIDE_VERTICALS.map(v => {
          const Icon = VERTICAL_ICONS[v.icon] ?? Wrench;
          return (
            <button
              key={v.key}
              onClick={() => { setVertical(vk => vk === v.key ? "" : v.key); setCategory(""); }}
              data-testid={`chip-vertical-${v.key}`}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
                vertical === v.key ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              <Icon className="w-3 h-3" /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Filters card */}
      <div className="bg-card border border-border rounded-xl p-4 mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-guide-search"
              placeholder="Search guides..."
              className="pl-9 bg-secondary"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-full sm:w-44 bg-secondary" data-testid="select-difficulty">
              <SelectValue placeholder="Any difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any difficulty</SelectItem>
              {DIFFICULTIES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-40 bg-secondary" data-testid="select-sortby">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quality">Best</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="views">Most Viewed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={handleSearch} className="gap-1.5 shrink-0" data-testid="button-search-guides">
              <Search className="w-4 h-4" /> Search
            </Button>
            {hasFilters && (
              <Button variant="ghost" onClick={resetFilters} className="shrink-0 text-muted-foreground">Reset</Button>
            )}
          </div>
        </div>

        {/* Category chips — dynamic based on vertical */}
        {categoryOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(c => (
              <button
                key={c}
                onClick={() => setCategory(cat => cat === c ? "" : c)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
                data-testid={`chip-category-${c}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {!isLoading && guides && (
        <p className="text-sm text-muted-foreground mb-4">
          {guides.length === 0 ? "No guides found" : `${guides.length} guide${guides.length !== 1 ? "s" : ""}`}
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
              <Plus className="w-4 h-4" /> Write the first guide
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {guides?.map(guide => <GuideCard key={guide.id} guide={guide} />)}
        </div>
      )}

      {/* Series section */}
      {seriesList && seriesList.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-display text-lg font-extrabold flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Series {vertical && activeVertical ? `— ${activeVertical.label}` : ""}
            </h2>
            <Link href="/guide-series" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.slice(0, 6).map((s: any) => <SeriesCard key={s.id} series={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
