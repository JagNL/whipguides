import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wrench, ChevronDown, ChevronUp, AlertTriangle, Package,
  ExternalLink, TrendingUp, Zap, Droplets,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface PartNeeded {
  name: string;
  category: string;
  type: string;
  confidence: number | string;
  reason: string;
}

interface UpgradeOpportunity {
  name: string;
  category: string;
  benefit: string;
  estimated_hp_gain?: number;
  brands?: string[];
  confidence: number | string;
  reason: string;
}

interface SafetyWarning {
  component: string;
  warning: string;
  severity: "critical" | "high" | "medium" | string;
}

interface AffiliateProduct {
  id: number;
  title: string;
  description?: string;
  affiliate_url: string;
  image_url?: string;
  price_cents?: number;
  brand?: string;
  part_number?: string;
  part_category?: string;
  quality_tier?: string;
  is_featured?: boolean;
  click_count?: number;
  vendor?: { name: string; logo_url?: string };
}

interface Manifest {
  vehicle?: { year?: string | number; make?: string; model?: string; engine?: string };
  partsNeeded: PartNeeded[];
  upgradeOpportunities: UpgradeOpportunity[];
  safetyWarnings: SafetyWarning[];
  fluids: string[];
  confidenceScore?: number;
}

interface AffiliateData {
  manifest: Manifest | null;
  products: AffiliateProduct[];
}

interface Props {
  guideId: number;
  vertical?: string;
}

// ─── Helpers ───────────────────────────────────────────────────
function formatPrice(cents?: number) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function confidenceBadge(conf: number | string) {
  const val = typeof conf === "string" ? parseFloat(conf) : conf;
  if (val >= 0.8) return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  if (val >= 0.5) return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
  return "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30";
}

function confidenceLabel(conf: number | string) {
  const val = typeof conf === "string" ? parseFloat(conf) : conf;
  if (val >= 0.8) return "High";
  if (val >= 0.5) return "Medium";
  return "Low";
}

function qualityBadge(tier?: string) {
  if (tier === "premium") return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
  if (tier === "standard") return "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30";
  if (tier === "budget") return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
  return "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30";
}

function severityStyles(severity: string) {
  if (severity === "critical") return { border: "border-red-500/40 bg-red-500/10", icon: "text-red-400", badge: "bg-red-500/15 text-red-400 border border-red-500/30" };
  if (severity === "high") return { border: "border-orange-500/40 bg-orange-500/10", icon: "text-orange-400", badge: "bg-orange-500/15 text-orange-400 border border-orange-500/30" };
  return { border: "border-amber-500/40 bg-amber-500/10", icon: "text-amber-400", badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30" };
}

// ─── Product Card ──────────────────────────────────────────────
function ProductCard({ product, guideId }: { product: AffiliateProduct; guideId: number }) {
  const clickMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/affiliate/click/${product.id}`, { guideId }).then(r => r.json()),
  });

  function handleClick() {
    clickMutation.mutate();
    window.open(product.affiliate_url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="bg-secondary/50 border border-border rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/40 transition-colors"
      onClick={handleClick}
      data-testid={`product-card-${product.id}`}
    >
      <div className="flex gap-3">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="w-16 h-16 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold line-clamp-2 leading-snug">{product.title}</p>
          {product.brand && (
            <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>
          )}
          {product.vendor?.name && (
            <p className="text-xs text-muted-foreground">{product.vendor.name}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.quality_tier && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${qualityBadge(product.quality_tier)}`}>
              {product.quality_tier}
            </span>
          )}
          {product.is_featured && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
              Featured
            </span>
          )}
        </div>
        {product.price_cents && (
          <span className="font-bold text-sm text-foreground">{formatPrice(product.price_cents)}</span>
        )}
      </div>

      <Button
        size="sm"
        className="w-full gap-1.5 mt-auto"
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        data-testid={`btn-view-deal-${product.id}`}
      >
        View Deal <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Parts Needed Section ──────────────────────────────────────
function PartsNeededSection({ parts, products }: { parts: PartNeeded[]; products: AffiliateProduct[] }) {
  if (!parts.length) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        Parts Needed
        <span className="text-muted-foreground font-normal">({parts.length})</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parts.map((part, i) => {
          const matching = products.filter(p => p.part_category === "replacement" &&
            p.title.toLowerCase().includes(part.name.toLowerCase().split(" ")[0]));
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{part.name}</p>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${confidenceBadge(part.confidence)}`}>
                    {confidenceLabel(part.confidence)}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border capitalize">
                    {part.type}
                  </span>
                </div>
              </div>
              {part.reason && (
                <p className="text-xs text-muted-foreground leading-relaxed">{part.reason}</p>
              )}
              {matching.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Available Products</p>
                  {matching.slice(0, 2).map(p => (
                    <ProductCard key={p.id} product={p} guideId={0} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Upgrade Opportunities Section ────────────────────────────
function UpgradesSection({ upgrades, products }: { upgrades: UpgradeOpportunity[]; products: AffiliateProduct[] }) {
  const [open, setOpen] = useState(false);
  if (!upgrades.length) return null;

  return (
    <div>
      <button
        className="w-full flex items-center justify-between gap-2 text-left group"
        onClick={() => setOpen(v => !v)}
        data-testid="btn-toggle-upgrades"
      >
        <h3 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Upgrade Opportunities
          <span className="text-muted-foreground font-normal">({upgrades.length})</span>
        </h3>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {upgrades.map((upg, i) => {
            const matching = products.filter(p => p.part_category === "upgrade" &&
              p.title.toLowerCase().includes(upg.name.toLowerCase().split(" ")[0]));
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm">{upg.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${confidenceBadge(upg.confidence)}`}>
                    {confidenceLabel(upg.confidence)}
                  </span>
                </div>
                {upg.benefit && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{upg.benefit}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {upg.estimated_hp_gain && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> +{upg.estimated_hp_gain} HP
                    </span>
                  )}
                  {upg.brands?.map((b, bi) => (
                    <span key={bi} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                      {b}
                    </span>
                  ))}
                </div>
                {matching.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Available Products</p>
                    {matching.slice(0, 2).map(p => (
                      <ProductCard key={p.id} product={p} guideId={0} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function PartsIntelligence({ guideId, vertical }: Props) {
  const { data, isLoading } = useQuery<AffiliateData>({
    queryKey: [`/api/affiliate/products/${guideId}`],
    queryFn: () => apiRequest("GET", `/api/affiliate/products/${guideId}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="mt-10 space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data?.manifest) return null;

  const { manifest, products } = data;

  return (
    <div className="mt-10 space-y-6" data-testid="parts-intelligence">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-display text-lg font-extrabold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          Parts &amp; Upgrades
        </h2>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Powered by AI
        </span>
      </div>

      {/* Safety warnings — always visible */}
      {manifest.safetyWarnings?.length > 0 && (
        <div className="space-y-2">
          {manifest.safetyWarnings.map((w, i) => {
            const styles = severityStyles(w.severity);
            return (
              <div key={i} className={`rounded-xl border p-4 flex gap-3 ${styles.border}`}>
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{w.component}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${styles.badge}`}>
                      {w.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{w.warning}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Parts Needed */}
      <PartsNeededSection parts={manifest.partsNeeded ?? []} products={products ?? []} />

      {/* Upgrade Opportunities */}
      <UpgradesSection upgrades={manifest.upgradeOpportunities ?? []} products={products ?? []} />

      {/* Fluids */}
      {manifest.fluids?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-primary" />
            Fluids
          </h3>
          <div className="flex flex-wrap gap-2">
            {manifest.fluids.map((f, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-card border border-border text-foreground">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground/60 border-t border-border pt-4">
        WhipGuides may earn a commission on qualifying purchases. Recommendations are AI-generated and may require human review.
      </p>
    </div>
  );
}

export default PartsIntelligence;
