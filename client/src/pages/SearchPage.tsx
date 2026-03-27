/**
 * Global search page — /search?q=...
 * Tabbed results: All · Listings · Groups · Guides · People · Posts
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCfUrl } from "@/hooks/use-cf-url";
import {
  Search, Car, Users, BookOpen, User, MessageSquare,
  Star, MapPin, Clock, Wrench, ChevronRight, TrendingUp, Zap,
} from "lucide-react";
import { formatPrice, timeAgo } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "listings", label: "Listings" },
  { key: "groups", label: "Groups" },
  { key: "guides", label: "Guides" },
  { key: "people", label: "People" },
  { key: "posts", label: "Posts" },
] as const;

type Tab = typeof TABS[number]["key"];

function ResultCount({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
      {n}
    </span>
  );
}

// ── Listing result card ──────────────────────────────────────
function ListingResult({ l }: { l: any }) {
  const cfUrl = useCfUrl();
  const img = l.images?.[0]
    ? (l.images[0].startsWith("http") ? l.images[0] : cfUrl ? `${cfUrl}/${l.images[0]}/public` : null)
    : null;
  return (
    <Link href={`/listing/${l.id}`}>
      <div className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
        <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
          {img ? <img src={img} alt={l.title} className="w-full h-full object-cover" /> : <Car className="w-6 h-6 text-muted-foreground/30" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{l.title}</p>
          <p className="text-primary font-bold text-sm">{formatPrice(l.price)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{l.condition}</span>
            {l.location && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{l.location}</span></>}
            {l.year && <><span>·</span><span>{l.year} {l.make} {l.model}</span></>}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 self-start text-xs">{l.category}</Badge>
      </div>
    </Link>
  );
}

// ── Group result card ────────────────────────────────────────
function GroupResult({ g }: { g: any }) {
  return (
    <Link href={`/groups/${g.id}`}>
      <div className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
          {g.cover_image ? <img src={g.cover_image} alt={g.name} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-muted-foreground/30" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{g.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(g.member_count || 0).toLocaleString()} members</span>
            {g.category && <><span>·</span><Badge variant="outline" className="text-[10px] px-1.5 py-0">{g.category}</Badge></>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Guide result card ────────────────────────────────────────
function GuideResult({ g }: { g: any }) {
  const diffColor = g.difficulty === "beginner" ? "text-emerald-400" : g.difficulty === "intermediate" ? "text-amber-400" : "text-red-400";
  return (
    <Link href={`/guides/${g.id}`}>
      <div className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{g.title}</p>
          <p className="text-xs text-primary/70 font-medium">{g.vehicle_year_start} {g.vehicle_make} {g.vehicle_model}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className={`capitalize font-medium ${diffColor}`}>{g.difficulty}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{g.time_estimate}h</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── User result card ─────────────────────────────────────────
function UserResult({ u }: { u: any }) {
  return (
    <Link href={`/profile/${u.id}`}>
      <div className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={u.avatar} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
            {(u.display_name || u.username)?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm group-hover:text-primary transition-colors">{u.display_name || u.username}</p>
            {u.verified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Verified</span>}
          </div>
          <p className="text-xs text-muted-foreground">@{u.username}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {u.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{u.rating.toFixed(1)}</span>}
            {u.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{u.location}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Post result card ─────────────────────────────────────────
function PostResult({ p }: { p: any }) {
  return (
    <Link href={`/groups/${p.group_id}`}>
      <div className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          <AvatarImage src={p.author?.avatar} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">{p.author?.display_name?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="font-semibold text-xs">{p.author?.display_name || p.author?.username}</span>
            <span className="text-[10px] text-muted-foreground">in</span>
            <span className="text-xs text-primary font-medium">{p.group?.name}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(p.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{p.content}</p>
        </div>
      </div>
    </Link>
  );
}

// ── Section header ───────────────────────────────────────────
function Section({ icon: Icon, title, count, children, viewAllHref }: {
  icon: React.ElementType; title: string; count: number;
  children: React.ReactNode; viewAllHref?: string;
}) {
  if (!count) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" />
          {title}
          <span className="text-xs font-medium normal-case text-foreground/60">({count})</span>
        </div>
        {viewAllHref && count > 3 && (
          <Link href={viewAllHref}>
            <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        )}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function SearchPage() {
  const [location, navigate] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Update query from URL
  useEffect(() => {
    setQuery(initialQ);
    setSubmitted(initialQ);
  }, [initialQ]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/search", submitted],
    queryFn: () => apiRequest("GET", `/api/search?q=${encodeURIComponent(submitted)}`).then(r => r.json()),
    enabled: submitted.length >= 2,
  });

  const results = data || { listings: [], groups: [], guides: [], users: [], posts: [] };
  const totalCount = results.listings.length + results.groups.length + results.guides.length + results.users.length + results.posts.length;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim().length >= 2) {
      setSubmitted(query.trim());
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const tabCounts: Record<Tab, number> = {
    all: totalCount,
    listings: results.listings.length,
    groups: results.groups.length,
    guides: results.guides.length,
    people: results.users.length,
    posts: results.posts.length,
  };

  const showListings = activeTab === "all" || activeTab === "listings";
  const showGroups = activeTab === "all" || activeTab === "groups";
  const showGuides = activeTab === "all" || activeTab === "guides";
  const showPeople = activeTab === "all" || activeTab === "people";
  const showPosts = activeTab === "all" || activeTab === "posts";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-global-search"
            autoFocus
            placeholder="Search listings, groups, guides, people..."
            className="pl-9 h-11 text-base bg-card"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 px-5 font-semibold" data-testid="button-search-submit">
          Search
        </Button>
      </form>

      {/* Tabs */}
      {submitted.length >= 2 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-search-${tab.key}`}
              className={`flex items-center shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
              <ResultCount n={tabCounts[tab.key]} label={tab.label} />
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && submitted.length >= 2 && totalCount === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No results for "{submitted}"</p>
          <p className="text-sm text-muted-foreground mt-1">Try different keywords or browse by category</p>
          <div className="flex justify-center gap-3 mt-5">
            <Link href="/"><Button variant="outline" size="sm">Browse Marketplace</Button></Link>
            <Link href="/groups"><Button variant="outline" size="sm">Browse Groups</Button></Link>
            <Link href="/guides"><Button variant="outline" size="sm">Browse Guides</Button></Link>
          </div>
        </div>
      )}

      {/* Prompt state */}
      {!submitted && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">Search everything on WhipGuides</p>
          <p className="text-sm text-muted-foreground mt-1">Listings, groups, guides, members, and posts</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && totalCount > 0 && (
        <div>
          {/* Listings */}
          {showListings && results.listings.length > 0 && (
            <Section icon={Car} title="Listings" count={results.listings.length} viewAllHref={`/?search=${encodeURIComponent(submitted)}`}>
              {(activeTab === "all" ? results.listings.slice(0, 4) : results.listings).map((l: any) => (
                <ListingResult key={l.id} l={l} />
              ))}
            </Section>
          )}

          {/* Groups */}
          {showGroups && results.groups.length > 0 && (
            <Section icon={Users} title="Groups" count={results.groups.length}>
              {(activeTab === "all" ? results.groups.slice(0, 3) : results.groups).map((g: any) => (
                <GroupResult key={g.id} g={g} />
              ))}
            </Section>
          )}

          {/* Guides */}
          {showGuides && results.guides.length > 0 && (
            <Section icon={BookOpen} title="Guides" count={results.guides.length} viewAllHref={`/guides?search=${encodeURIComponent(submitted)}`}>
              {(activeTab === "all" ? results.guides.slice(0, 3) : results.guides).map((g: any) => (
                <GuideResult key={g.id} g={g} />
              ))}
            </Section>
          )}

          {/* People */}
          {showPeople && results.users.length > 0 && (
            <Section icon={User} title="People" count={results.users.length}>
              {(activeTab === "all" ? results.users.slice(0, 4) : results.users).map((u: any) => (
                <UserResult key={u.id} u={u} />
              ))}
            </Section>
          )}

          {/* Posts */}
          {showPosts && results.posts.length > 0 && (
            <Section icon={MessageSquare} title="Posts" count={results.posts.length}>
              {(activeTab === "all" ? results.posts.slice(0, 4) : results.posts).map((p: any) => (
                <PostResult key={p.id} p={p} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
