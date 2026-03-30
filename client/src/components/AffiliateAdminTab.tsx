import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3, CheckCircle, XCircle, RefreshCw, Star, Trash2,
  Plus, ExternalLink, Package, TrendingUp, Brain, DollarSign,
  ChevronDown, ChevronUp, AlertTriangle, Eye,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Shared sub-tab pill nav ─────────────────────────────────
type SubTab = "overview" | "queue" | "vendors" | "products" | "analytics";

// ─── Overview sub-tab ────────────────────────────────────────
function AffiliateOverviewTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/status"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/status").then(r => r.json()),
  });
  const { toast } = useToast();
  const [reprocessDialog, setReprocessDialog] = useState(false);

  const reprocessMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/affiliate/admin/reprocess", { limit: 50 }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Reprocess queued", description: "Extraction started for up to 50 guides." });
      setReprocessDialog(false);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  }

  const s = data?.stats || {};
  const llmProviders: any[] = data?.llmProviders || [];
  const affiliateProviders: any[] = data?.affiliateProviders || [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Reviews", value: s.pendingReviews ?? 0, urgent: (s.pendingReviews ?? 0) > 0, icon: AlertTriangle },
          { label: "Active Vendors", value: s.activeVendors ?? 0, icon: Package },
          { label: "Approved Products", value: s.approvedProducts ?? 0, icon: CheckCircle },
          { label: "Clicks (30d)", value: s.clicks30d ?? 0, icon: TrendingUp },
        ].map(({ label, value, urgent, icon: Icon }) => (
          <div key={label} className={`bg-card rounded-xl border p-5 ${urgent ? "border-destructive/40" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`w-5 h-5 ${urgent ? "text-destructive" : "text-primary"}`} />
            </div>
            <p className={`text-3xl font-extrabold ${urgent ? "text-destructive" : ""}`}>{value?.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* LLM Providers */}
      {llmProviders.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> LLM Providers</h3>
          <div className="space-y-2">
            {llmProviders.map((p: any) => (
              <div key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-28 font-medium capitalize">{p.name}</span>
                <ProviderStatusBadge status={p.status} />
                {p.model && <span className="text-xs text-muted-foreground font-mono">{p.model}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affiliate Providers */}
      {affiliateProviders.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Affiliate Providers</h3>
          <div className="space-y-2">
            {affiliateProviders.map((p: any) => (
              <div key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-28 font-medium capitalize">{p.name}</span>
                <ProviderStatusBadge status={p.status} />
                {p.tag && <span className="text-xs text-muted-foreground font-mono">{p.tag}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reprocess button */}
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setReprocessDialog(true)} data-testid="btn-reprocess-all">
          <RefreshCw className="w-4 h-4" /> Re-run Extraction on All Guides
        </Button>
      </div>

      <AlertDialog open={reprocessDialog} onOpenChange={setReprocessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run AI Extraction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will queue up to 50 guides for parts extraction using the configured LLM provider. This may take several minutes and incur API costs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => reprocessMutation.mutate()} disabled={reprocessMutation.isPending}>
              {reprocessMutation.isPending ? "Processing..." : "Run Extraction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProviderStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-[10px] h-5">Active</Badge>;
  if (status === "configured") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 border text-[10px] h-5">Configured</Badge>;
  return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 border text-[10px] h-5">Not Configured</Badge>;
}

// ─── Review Queue sub-tab ────────────────────────────────────
function ReviewQueueTab() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [editedParts, setEditedParts] = useState<any[]>([]);
  const [editedUpgrades, setEditedUpgrades] = useState<any[]>([]);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/queue", statusFilter],
    queryFn: () => apiRequest("GET", `/api/affiliate/admin/queue?status=${statusFilter}`).then(r => r.json()),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, notes }: any) =>
      apiRequest("PATCH", `/api/affiliate/admin/queue/${id}`, {
        action,
        reviewNotes: notes,
        manifest: action === "approve" ? { partsNeeded: editedParts, upgradeOpportunities: editedUpgrades } : undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Manifest updated" });
      setReviewTarget(null);
      refetch();
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const reExtractMutation = useMutation({
    mutationFn: (guideId: number) =>
      apiRequest("POST", `/api/affiliate/admin/queue/extract/${guideId}`, {}).then(r => r.json()),
    onSuccess: () => { toast({ title: "Re-extraction queued" }); refetch(); },
  });

  function openReview(item: any) {
    setReviewTarget(item);
    setReviewNotes("");
    setEditedParts(item.manifest?.partsNeeded ?? []);
    setEditedUpgrades(item.manifest?.upgradeOpportunities ?? []);
  }

  const STATUS_FILTERS = ["pending", "approved", "auto_approved", "rejected"];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (data?.items || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No {statusFilter} manifests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.items || []).map((item: any) => {
            const m = item.manifest || {};
            const safetyCount = m.safetyWarnings?.length ?? 0;
            const score = m.confidenceScore ?? 0;
            const scoreColor = score >= 0.8 ? "bg-emerald-500" : score >= 0.6 ? "bg-yellow-500" : "bg-red-500";
            return (
              <div key={item.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.guide?.title || `Guide #${item.guide_id}`}</p>
                    {m.vehicle && (
                      <p className="text-xs text-muted-foreground">{m.vehicle.year} {m.vehicle.make} {m.vehicle.model}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {item.extraction_model && (
                        <span className="text-[10px] font-mono text-muted-foreground">{item.extraction_model}</span>
                      )}
                      {safetyCount > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                          ⚠ {safetyCount} warning{safetyCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{m.partsNeeded?.length ?? 0} parts · {m.upgradeOpportunities?.length ?? 0} upgrades</span>
                    </div>
                    {/* Confidence bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-[120px]">
                        <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${score * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{Math.round(score * 100)}% confidence</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 gap-1 shrink-0" onClick={() => openReview(item)} data-testid={`btn-review-${item.id}`}>
                    <Eye className="w-3.5 h-3.5" /> Review
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Manifest — {reviewTarget.guide?.title || `Guide #${reviewTarget.guide_id}`}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              {/* Vehicle */}
              {reviewTarget.manifest?.vehicle && (
                <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                  <span className="font-semibold">Vehicle: </span>
                  {reviewTarget.manifest.vehicle.year} {reviewTarget.manifest.vehicle.make} {reviewTarget.manifest.vehicle.model}
                  {reviewTarget.manifest.vehicle.engine && ` — ${reviewTarget.manifest.vehicle.engine}`}
                </div>
              )}

              {/* Parts Needed — editable */}
              <div>
                <p className="text-sm font-semibold mb-2">Parts Needed</p>
                <div className="space-y-2">
                  {editedParts.map((part, i) => (
                    <div key={i} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
                      <Input className="flex-1 h-7 text-xs" value={part.name}
                        onChange={e => setEditedParts(ps => ps.map((p, pi) => pi === i ? { ...p, name: e.target.value } : p))} />
                      <Select value={String(part.confidence)} onValueChange={v => setEditedParts(ps => ps.map((p, pi) => pi === i ? { ...p, confidence: v } : p))}>
                        <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.9">High</SelectItem>
                          <SelectItem value="0.6">Medium</SelectItem>
                          <SelectItem value="0.3">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                        onClick={() => setEditedParts(ps => ps.filter((_, pi) => pi !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {editedParts.length === 0 && <p className="text-xs text-muted-foreground">No parts</p>}
                </div>
              </div>

              {/* Upgrades — editable */}
              {editedUpgrades.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Upgrades</p>
                  <div className="space-y-2">
                    {editedUpgrades.map((upg, i) => (
                      <div key={i} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
                        <Input className="flex-1 h-7 text-xs" value={upg.name}
                          onChange={e => setEditedUpgrades(us => us.map((u, ui) => ui === i ? { ...u, name: e.target.value } : u))} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setEditedUpgrades(us => us.filter((_, ui) => ui !== i))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety warnings */}
              {reviewTarget.manifest?.safetyWarnings?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-red-400">Safety Warnings</p>
                  {reviewTarget.manifest.safetyWarnings.map((w: any, i: number) => (
                    <div key={i} className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-1">
                      <span className="font-semibold">{w.component}: </span>{w.warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Fluids */}
              {reviewTarget.manifest?.fluids?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-1">Fluids</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewTarget.manifest.fluids.map((f: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-xs mb-1 block">Review Notes</Label>
                <Textarea placeholder="Optional notes..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} className="resize-none min-h-[60px]" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => actionMutation.mutate({ id: reviewTarget.id, action: "approve", notes: reviewNotes })}
                  disabled={actionMutation.isPending} data-testid="btn-approve-manifest">
                  <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
                </Button>
                <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => actionMutation.mutate({ id: reviewTarget.id, action: "reject", notes: reviewNotes })}
                  disabled={actionMutation.isPending} data-testid="btn-reject-manifest">
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
                <Button variant="outline" className="gap-1.5"
                  onClick={() => reExtractMutation.mutate(reviewTarget.guide_id)}
                  disabled={reExtractMutation.isPending} data-testid="btn-reextract">
                  <RefreshCw className="w-4 h-4" /> Re-extract
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Vendors sub-tab ─────────────────────────────────────────
const PROVIDER_TYPES = ["amazon", "rockauto", "brownells", "midwayusa", "summit_racing", "sweetwater", "generic"];
const QUALITY_TIERS = ["premium", "standard", "budget"];
const VERTICALS = ["automotive", "powersports", "firearms", "outdoors", "music", "maker", "tech", "collectibles", "general"];

const BLANK_VENDOR = {
  name: "", slug: "", provider_type: "generic", base_url: "",
  affiliate_tag: "", api_key: "", commission_rate: "", quality_tier: "standard",
  verticals: [] as string[], description: "", notes: "",
};

function VendorsTab() {
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK_VENDOR });
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/vendors"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/vendors").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: () => editTarget
      ? apiRequest("PATCH", `/api/affiliate/admin/vendors/${editTarget.id}`, form).then(r => r.json())
      : apiRequest("POST", "/api/affiliate/admin/vendors", form).then(r => r.json()),
    onSuccess: () => { toast({ title: editTarget ? "Vendor updated" : "Vendor added" }); setShowDialog(false); refetch(); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/affiliate/admin/vendors/${id}`, {}).then(r => r.json()),
    onSuccess: () => { toast({ title: "Vendor suspended" }); refetch(); },
  });

  function openAdd() {
    setEditTarget(null);
    setForm({ ...BLANK_VENDOR });
    setShowDialog(true);
  }

  function openEdit(v: any) {
    setEditTarget(v);
    setForm({
      name: v.name ?? "", slug: v.slug ?? "", provider_type: v.provider_type ?? "generic",
      base_url: v.base_url ?? "", affiliate_tag: v.affiliate_tag ?? "", api_key: v.api_key ?? "",
      commission_rate: String(v.commission_rate ?? ""), quality_tier: v.quality_tier ?? "standard",
      verticals: v.verticals ?? [], description: v.description ?? "", notes: v.notes ?? "",
    });
    setShowDialog(true);
  }

  function toggleVertical(v: string) {
    setForm(f => ({
      ...f,
      verticals: f.verticals.includes(v) ? f.verticals.filter(x => x !== v) : [...f.verticals, v],
    }));
  }

  const vendors: any[] = data?.vendors || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openAdd} data-testid="btn-add-vendor">
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No vendors yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Vendor</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Commission</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Quality</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.map((v: any) => (
                <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.verticals?.join(", ")}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell capitalize">{v.provider_type}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{v.commission_rate ? `${v.commission_rate}%` : "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell capitalize">{v.quality_tier}</td>
                  <td className="px-4 py-3">
                    <VendorStatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(v)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                        onClick={() => suspendMutation.mutate(v.id)}>Suspend</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={e => {
                  const name = e.target.value;
                  setForm(f => ({ ...f, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }));
                }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Provider Type</Label>
              <Select value={form.provider_type} onValueChange={v => setForm(f => ({ ...f, provider_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDER_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Base URL</Label>
              <Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Affiliate Tag / ID</Label>
                <Input type="password" value={form.affiliate_tag} onChange={e => setForm(f => ({ ...f, affiliate_tag: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <Input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Commission Rate (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quality Tier</Label>
                <Select value={form.quality_tier} onValueChange={v => setForm(f => ({ ...f, quality_tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUALITY_TIERS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Verticals</Label>
              <div className="flex flex-wrap gap-1.5">
                {VERTICALS.map(v => (
                  <button key={v} type="button" onClick={() => toggleVertical(v)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors capitalize ${form.verticals.includes(v) ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="resize-none min-h-[60px]" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : (editTarget ? "Save Changes" : "Add Vendor")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VendorStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-[10px]">Active</Badge>;
  if (status === "paused") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 border text-[10px]">Paused</Badge>;
  return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 border text-[10px]">Suspended</Badge>;
}

// ─── Products sub-tab ─────────────────────────────────────────
function ProductsTab() {
  const [filter, setFilter] = useState("approved");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/products", filter],
    queryFn: () => apiRequest("GET", `/api/affiliate/admin/products?status=${filter}`).then(r => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: any) =>
      apiRequest("PATCH", `/api/affiliate/admin/products/${id}`, body).then(r => r.json()),
    onSuccess: () => { toast({ title: "Product updated" }); refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/affiliate/admin/products/${id}`, {}).then(r => r.json()),
    onSuccess: () => { toast({ title: "Product deleted" }); refetch(); },
  });

  const products: any[] = data?.products || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["approved", "pending", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No products</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Product</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Vendor</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Price</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Clicks</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.part_category} · {p.quality_tier}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{p.vendor?.name}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.price_cents ? `$${(p.price_cents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{p.click_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => patchMutation.mutate({ id: p.id, is_approved: !p.is_approved })}>
                        {p.is_approved
                          ? <><XCircle className="w-3.5 h-3.5 text-destructive" /> Unapprove</>
                          : <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Approve</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => patchMutation.mutate({ id: p.id, is_featured: !p.is_featured })}>
                        <Star className={`w-3.5 h-3.5 ${p.is_featured ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        {p.is_featured ? "Unfeature" : "Feature"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                        onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Analytics sub-tab ───────────────────────────────────────
function AnalyticsTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/analytics"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/analytics").then(r => r.json()),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  }

  const clicks: any[] = data?.clicksByDay || [];
  const topProducts: any[] = data?.topProducts || [];
  const totalClicks = data?.totalClicks ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Clicks (30d)</p>
          <p className="text-3xl font-extrabold">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Est. Revenue (30d)</p>
          <p className="text-3xl font-extrabold text-primary">${Number(totalRevenue).toFixed(2)}</p>
        </div>
      </div>

      {/* Bar Chart */}
      {clicks.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm font-semibold mb-4">Clicks — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={clicks} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
              <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Top Products</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Product</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs hidden md:table-cell">Vendor</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Clicks</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs hidden lg:table-cell">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topProducts.map((p: any, i: number) => (
                <tr key={p.id || i} className="hover:bg-secondary/30">
                  <td className="px-4 py-2.5 font-medium text-sm line-clamp-1">{p.title}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{p.vendor}</td>
                  <td className="px-4 py-2.5">{p.clicks?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">${Number(p.revenue ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main AffiliateAdminTab ──────────────────────────────────
export function AffiliateAdminTab() {
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "queue", label: "Review Queue" },
    { id: "vendors", label: "Vendors" },
    { id: "products", label: "Products" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === t.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            data-testid={`subtab-affiliate-${t.id}`}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "overview" && <AffiliateOverviewTab />}
      {subTab === "queue" && <ReviewQueueTab />}
      {subTab === "vendors" && <VendorsTab />}
      {subTab === "products" && <ProductsTab />}
      {subTab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

export default AffiliateAdminTab;
