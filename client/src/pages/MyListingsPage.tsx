/**
 * MyListingsPage — /my-listings
 * Seller dashboard: active, expired, sold listings with expiry
 * countdown, health score, refresh/bump/sold actions.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCfUrl } from "@/hooks/use-cf-url";
import {
  Plus, RefreshCw, CheckCircle2, Eye, Heart, Clock,
  AlertTriangle, Zap, BarChart3, Tag, TrendingUp,
  Pencil, Trash2, ChevronRight, Timer,
} from "lucide-react";
import { formatPrice, listingUrl, timeAgo } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Expiry helpers ─────────────────────────────────────────────
function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function ExpiryChip({ expiresAt, status }: { expiresAt: string | null; status: string }) {
  if (status === "sold") return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Sold</Badge>;
  if (status === "expired") return <Badge className="text-[10px] bg-muted text-muted-foreground border-border">Expired</Badge>;
  if (!expiresAt) return null;
  const days = daysUntilExpiry(expiresAt);
  if (days === null) return null;
  if (days <= 0)  return <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30"><Timer className="w-2.5 h-2.5 mr-1" />Expired</Badge>;
  if (days <= 3)  return <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30 animate-pulse"><Timer className="w-2.5 h-2.5 mr-1" />Expires in {days}d</Badge>;
  if (days <= 7)  return <Badge className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30"><Timer className="w-2.5 h-2.5 mr-1" />Expires in {days}d</Badge>;
  return <Badge className="text-[10px] bg-muted/60 text-muted-foreground border-border"><Timer className="w-2.5 h-2.5 mr-1" />{days}d left</Badge>;
}

// ── Health Score Bar ───────────────────────────────────────────
function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-destructive";
  const label = score >= 80 ? "Great" : score >= 50 ? "Good" : "Needs work";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-medium ${score >= 80 ? "text-emerald-400" : score >= 50 ? "text-yellow-400" : "text-destructive"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Stat pill ──────────────────────────────────────────────────
function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="w-3 h-3" />
      <span>{value?.toLocaleString() || 0}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// ── Listing Row ────────────────────────────────────────────────
function ListingRow({
  listing,
  cfBase,
  onRefresh,
  onSold,
  onDelete,
  isRefreshing,
  isMarkingSold,
}: {
  listing: any;
  cfBase: string;
  onRefresh: () => void;
  onSold: () => void;
  onDelete: () => void;
  isRefreshing: boolean;
  isMarkingSold: boolean;
}) {
  const [showSoldConfirm, setShowSoldConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const thumb = listing.images?.[0]
    ? `${cfBase}/${listing.images[0]}/public`
    : null;

  const days = daysUntilExpiry(listing.expires_at);
  const urgentExpiry = days !== null && days <= 3 && listing.status === "active";

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${urgentExpiry ? "border-destructive/40" : "border-border"}`}>
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <Link href={listingUrl(listing.id, listing.title)}>
          <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg overflow-hidden bg-muted/30 shrink-0 cursor-pointer">
            {thumb
              ? <img src={thumb} alt={listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🚗</div>
            }
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link href={listingUrl(listing.id, listing.title)}>
              <h3 className="font-semibold text-sm leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-2">
                {listing.title}
              </h3>
            </Link>
            <span className="font-bold text-primary text-sm shrink-0">{formatPrice(listing.price)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExpiryChip expiresAt={listing.expires_at} status={listing.status} />
            {listing.bump_count > 0 && (
              <span className="text-[10px] text-muted-foreground">↑ bumped {listing.bump_count}×</span>
            )}
            <span className="text-[10px] text-muted-foreground">Listed {timeAgo(listing.created_at)}</span>
          </div>

          {/* Health score — only for active */}
          {listing.status === "active" && listing.health_score !== undefined && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Listing quality</span>
                <span>{listing.health_score}%</span>
              </div>
              <HealthBar score={listing.health_score} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Stat icon={Eye} value={listing.views || 0} label="views" />
            <Stat icon={Heart} value={listing.saves || 0} label="saves" />
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2 bg-secondary/20">
        {(listing.status === "active" || listing.status === "expired") && (
          <Button
            size="sm" variant="outline"
            className={`h-7 text-xs gap-1.5 ${urgentExpiry ? "border-destructive/50 text-destructive hover:bg-destructive/10" : ""}`}
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            {listing.status === "expired" ? "Relist" : "Refresh & Bump"}
          </Button>
        )}
        {listing.status === "active" && (
          <>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setShowSoldConfirm(true)} disabled={isMarkingSold}>
              <CheckCircle2 className="w-3 h-3" /> Mark Sold
            </Button>
            <Link href={listingUrl(listing.id, listing.title)}>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground">
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            </Link>
          </>
        )}
        <Button size="sm" variant="ghost"
          className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10 ml-auto"
          onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Sold confirm */}
      <AlertDialog open={showSoldConfirm} onOpenChange={setShowSoldConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as sold?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the listing and send you a confirmation email. You can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSoldConfirm(false); onSold(); }} className="bg-emerald-600 hover:bg-emerald-700">
              Yes, it sold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the listing. Can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteConfirm(false); onDelete(); }} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function MyListingsPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const cfBase = useCfUrl();
  const [statusTab, setStatusTab] = useState<"active" | "expired" | "sold">("active");

  const { data: listings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/my-listings", statusTab],
    queryFn: () => apiRequest("GET", `/api/my-listings?status=${statusTab}`).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const refreshMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/listings/${id}/refresh`).then(r => r.json()),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/search/listings"] });
      toast({ title: "Listing refreshed — back to the top!" });
    },
    onError: (e: any) => toast({ title: "Couldn't refresh", description: e.message, variant: "destructive" }),
  });

  const soldMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/listings/${id}/sold`).then(r => r.json()),
    onSuccess: () => {
      refetch();
      toast({ title: "Congrats on the sale! 🎉" });
    },
    onError: (e: any) => toast({ title: "Couldn't update listing", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/listings/${id}`).then(r => r.json()),
    onSuccess: () => {
      refetch();
      toast({ title: "Listing deleted" });
    },
    onError: (e: any) => toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }),
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-bold mb-2">Sign in to manage your listings</h2>
      </div>
    );
  }

  // Stats
  const expiringSOon = listings.filter(l => {
    const d = daysUntilExpiry(l.expires_at);
    return l.status === "active" && d !== null && d <= 7;
  }).length;

  const totalViews = listings.filter(l => l.status === "active").reduce((s: number, l: any) => s + (l.views || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Listings</h1>
          <p className="text-sm text-muted-foreground">Manage your items for sale</p>
        </div>
        <Link href="/sell">
          <Button className="gap-1.5">
            <Plus className="w-4 h-4" /> New Listing
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-blue-400" },
          { label: "Expiring Soon", value: expiringSOon, icon: AlertTriangle, color: expiringSOon > 0 ? "text-yellow-400" : "text-muted-foreground", urgent: expiringSOon > 0 },
          { label: "Active", value: listings.filter(l => l.status === "active").length, icon: Zap, color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color, urgent }) => (
          <div key={label} className={`bg-card border rounded-xl p-3 ${urgent ? "border-yellow-500/30" : "border-border"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Expiry warning banner */}
      {expiringSOon > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="font-semibold text-sm">{expiringSOon} listing{expiringSOon > 1 ? "s" : ""} expiring within 7 days</p>
            <p className="text-xs text-muted-foreground">Refresh them now to reset the clock and bump to the top of search results.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["active", "expired", "sold"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              statusTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 space-y-3 text-muted-foreground">
          <Tag className="w-10 h-10 mx-auto opacity-30" />
          <p className="font-semibold">
            {statusTab === "active" ? "No active listings" : statusTab === "expired" ? "No expired listings" : "Nothing sold yet"}
          </p>
          {statusTab === "active" && (
            <Link href="/sell">
              <Button className="mt-2">
                <Plus className="w-4 h-4 mr-1.5" /> Create your first listing
              </Button>
            </Link>
          )}
          {statusTab === "expired" && (
            <p className="text-sm">Expired listings can be relisted in one click.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing: any) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              cfBase={cfBase}
              onRefresh={() => refreshMut.mutate(listing.id)}
              onSold={() => soldMut.mutate(listing.id)}
              onDelete={() => deleteMut.mutate(listing.id)}
              isRefreshing={refreshMut.isPending && (refreshMut.variables as any) === listing.id}
              isMarkingSold={soldMut.isPending && (soldMut.variables as any) === listing.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
