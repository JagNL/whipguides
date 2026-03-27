/**
 * AdCard — native feed advertisement blended seamlessly into listing grids.
 * Matches ListingCard dimensions exactly. Discloses "Sponsored" clearly but subtly.
 */
import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useCfUrl } from "@/hooks/use-cf-url";

export interface AdData {
  id: number;
  headline: string;
  body?: string;
  ctaText: string;
  ctaUrl: string;
  imageId?: string;
  imageUrl?: string;
  advertiser?: string;
  format: string;
}

interface AdCardProps {
  ad: AdData;
  onDismiss?: () => void;
  compact?: boolean;
}

export default function AdCard({ ad, onDismiss, compact }: AdCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const cfBase = useCfUrl();

  if (dismissed) return null;

  const imgSrc = ad.imageId && cfBase
    ? `${cfBase}/${ad.imageId}/public`
    : ad.imageUrl || null;

  const handleClick = () => {
    // Record click (fire & forget)
    apiRequest("POST", `/api/ads/${ad.id}/click`).catch(() => {});
    window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  };

  if (compact) {
    return (
      <div
        className="relative bg-card border border-border/50 border-dashed rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all group"
        onClick={handleClick}
        data-testid={`ad-card-${ad.id}`}
      >
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Image */}
        {imgSrc ? (
          <div className="aspect-[4/3] overflow-hidden bg-muted/30">
            <img src={imgSrc} alt={ad.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <span className="text-3xl opacity-40">📣</span>
          </div>
        )}

        <div className="p-3 space-y-1">
          {/* Sponsored pill */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded">
              Sponsored
            </span>
            {ad.advertiser && (
              <span className="text-[10px] text-muted-foreground truncate">{ad.advertiser}</span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{ad.headline}</p>
          {ad.body && <p className="text-xs text-muted-foreground line-clamp-1">{ad.body}</p>}
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
              {ad.ctaText}
              <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full card — slightly wider/different feel for sidebar placement
  return (
    <div
      className="relative bg-card border border-border/50 border-dashed rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all group"
      onClick={handleClick}
      data-testid={`ad-card-full-${ad.id}`}
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        aria-label="Dismiss ad"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {imgSrc && (
        <div className="aspect-video overflow-hidden bg-muted/20">
          <img src={imgSrc} alt={ad.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}

      {!imgSrc && (
        <div className="aspect-video bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center">
          <span className="text-5xl opacity-30">📣</span>
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase bg-muted/70 px-2 py-0.5 rounded-full">
            Sponsored
          </span>
          {ad.advertiser && (
            <span className="text-xs text-muted-foreground">{ad.advertiser}</span>
          )}
        </div>

        <h3 className="font-semibold text-sm leading-snug">{ad.headline}</h3>
        {ad.body && <p className="text-xs text-muted-foreground leading-relaxed">{ad.body}</p>}

        <button className="mt-2 w-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
          {ad.ctaText}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Feed injector: given a list of items, inject ads at regular intervals ──
export function injectAdsIntoFeed<T>(items: T[], ads: AdData[], every = 8): (T | { __isAd: true; ad: AdData })[] {
  if (!ads.length) return items;
  const result: (T | { __isAd: true; ad: AdData })[] = [];
  let adIndex = 0;

  items.forEach((item, i) => {
    result.push(item);
    // Inject ad after every N items (not at position 0)
    if ((i + 1) % every === 0 && adIndex < ads.length) {
      result.push({ __isAd: true, ad: ads[adIndex++] });
    }
  });

  return result;
}
