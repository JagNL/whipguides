import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Lock, Plus, TrendingUp } from "lucide-react";

const CATEGORIES = ["All", "Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "General"];

function GroupCard({ group }: { group: any }) {
  return (
    <Link href={`/groups/${group.id}`}>
      <div
        className="bg-card rounded-xl border border-border overflow-hidden hover-elevate cursor-pointer group transition-colors hover:border-primary/40"
        data-testid={`card-group-${group.id}`}
      >
        {/* Cover */}
        <div className="relative h-36 bg-secondary overflow-hidden">
          {group.coverImage ? (
            <img
              src={group.coverImage}
              alt={group.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-70"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🏁</div>
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

        {/* Info */}
        <div className="p-4">
          <h3 className="font-bold text-base mb-1 line-clamp-1">{group.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{group.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {(group.memberCount || 0).toLocaleString()} members
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {(group.postCount || 0).toLocaleString()} posts
              </span>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7 px-3" data-testid={`button-join-group-${group.id}`}
              onClick={e => e.preventDefault()}>
              Join
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function GroupsPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", activeCategory],
    queryFn: () => apiRequest("GET", `/api/groups?category=${activeCategory}`).then(r => r.json()),
  });

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
        <Button className="gap-2 shrink-0" data-testid="button-create-group">
          <Plus className="w-4 h-4" /> Create Group
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            data-testid={`filter-group-category-${cat.toLowerCase()}`}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
