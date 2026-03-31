import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Users, CheckCircle, Building2 } from "lucide-react";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";

interface BusinessCardProps {
  page: {
    id: number;
    name: string;
    slug: string;
    tagline?: string;
    category: string;
    logo_id?: string;
    cover_id?: string;
    city?: string;
    state?: string;
    verified?: boolean;
    follower_count: number;
    post_count: number;
    avg_rating?: number;
    review_count?: number;
  };
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Dealership":       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Auto Repair":      "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Parts Supplier":   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Motorsports Shop": "bg-red-500/15 text-red-400 border-red-500/30",
  "Custom Shop":      "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Towing":           "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  "Detailing":        "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "Rental":           "bg-green-500/15 text-green-400 border-green-500/30",
  "Firearms Dealer":  "bg-stone-500/15 text-stone-400 border-stone-500/30",
  "Marine":           "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "General":          "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function BusinessCard({ page, compact = false }: BusinessCardProps) {
  const [, navigate] = useLocation();
  const cfUrl = useCfUrl();

  const logoSrc = page.logo_id
    ? (cfImageUrl(cfUrl, page.logo_id) || page.logo_id)
    : null;

  const coverSrc = page.cover_id
    ? (cfImageUrl(cfUrl, page.cover_id) || page.cover_id)
    : null;

  const catClass = CATEGORY_COLORS[page.category] || CATEGORY_COLORS["General"];

  if (compact) {
    return (
      <div
        data-testid={`business-card-compact-${page.id}`}
        onClick={() => navigate(`/business/${page.slug}`)}
        className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 transition-colors cursor-pointer group"
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {logoSrc ? (
            <img src={logoSrc} alt={page.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-5 h-5 text-orange-400" />
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm text-white truncate">{page.name}</span>
            {page.verified && <CheckCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
          </div>
          <span className="text-xs text-white/50">{page.category}</span>
        </div>
        <Users className="w-4 h-4 text-white/30 group-hover:text-orange-400 transition-colors flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      data-testid={`business-card-${page.id}`}
      onClick={() => navigate(`/business/${page.slug}`)}
      className="rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
    >
      {/* Cover */}
      <div className="relative h-28 bg-gradient-to-br from-orange-900/30 to-zinc-800/60">
        {coverSrc && (
          <img src={coverSrc} alt="" className="w-full h-full object-cover opacity-60" />
        )}
        {/* Category badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catClass}`}>
            {page.category}
          </span>
        </div>
      </div>

      {/* Logo + name row */}
      <div className="px-4 pb-4">
        {/* Logo overlapping cover */}
        <div className="flex items-end gap-3 -mt-6 mb-3">
          <div className="w-14 h-14 rounded-xl border-2 border-black bg-zinc-900 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
            {logoSrc ? (
              <img src={logoSrc} alt={page.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-7 h-7 text-orange-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-white text-sm truncate">{page.name}</h3>
              {page.verified && (
                <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" title="Verified Business" />
              )}
            </div>
            {(page.city || page.state) && (
              <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
                <MapPin className="w-3 h-3" />
                <span>{[page.city, page.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tagline */}
        {page.tagline && (
          <p className="text-xs text-white/60 mb-3 line-clamp-2">{page.tagline}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {page.follower_count.toLocaleString()} followers
          </span>
          {page.avg_rating && page.avg_rating > 0 ? (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {page.avg_rating.toFixed(1)}
              {page.review_count ? ` (${page.review_count})` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
