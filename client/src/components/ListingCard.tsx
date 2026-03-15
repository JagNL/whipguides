import { Link } from "wouter";
import { Heart, Eye, MapPin, ShieldCheck, Star, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { timeAgo } from "@/lib/utils";

interface ListingCardProps {
  listing: any;
}

const CONDITION_STYLES: Record<string, string> = {
  "Like New": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Excellent": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Good": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Fair": "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Cars": "🚗",
  "Trucks": "🛻",
  "ATVs": "🏍️",
  "Jet Skis": "🚤",
  "Motorcycles": "🏍️",
  "Boats": "⛵",
  "Snowmobiles": "🏔️",
};

export default function ListingCard({ listing }: ListingCardProps) {
  const [saved, setSaved] = useState(false);
  const img = listing.images?.[0] || "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80";

  return (
    <div className="listing-card group" data-testid={`card-listing-${listing.id}`}>
      {/* Image */}
      <Link href={`/listing/${listing.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          <img
            src={img}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {/* Featured badge */}
          {listing.featured && (
            <div className="absolute top-2 left-2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                FEATURED
              </span>
            </div>
          )}
          {/* Category pill */}
          <div className="absolute top-2 right-10">
            <span className="bg-background/80 backdrop-blur-sm text-xs font-medium px-2 py-0.5 rounded-full border border-border">
              {CATEGORY_ICONS[listing.category] || "🔧"} {listing.category}
            </span>
          </div>
          {/* Save button */}
          <button
            data-testid={`button-save-${listing.id}`}
            onClick={e => { e.preventDefault(); setSaved(s => !s); }}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm border border-border hover:border-primary transition-all"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${saved ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          </button>
        </div>
      </Link>

      {/* Content */}
      <Link href={`/listing/${listing.id}`}>
        <div className="p-3 space-y-2">
          {/* Price + condition */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xl font-extrabold text-display text-foreground">
              ${listing.price.toLocaleString()}
            </span>
            <Badge variant="outline" className={`text-xs shrink-0 ${CONDITION_STYLES[listing.condition] || ""}`}>
              {listing.condition}
            </Badge>
          </div>

          {/* Title */}
          <p className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
            {listing.title}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {listing.location}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {listing.views || 0}</span>
              <span>·</span>
              <span>{listing.createdAt}</span>
            </div>
          </div>

          {/* Seller */}
          {listing.seller && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <img
                src={listing.seller.avatar || "https://i.pravatar.cc/150?img=1"}
                alt={listing.seller.displayName}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {listing.seller.displayName}
                {listing.seller.verified && <ShieldCheck className="w-3 h-3 text-primary" />}
              </span>
              {listing.seller.rating > 0 && (
                <span className="ml-auto text-xs flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {listing.seller.rating.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
