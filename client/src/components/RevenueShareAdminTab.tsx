import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, CheckCircle2, XCircle,
  Settings, BarChart2, ListChecks, Users, Download, RefreshCw,
  ShieldCheck, AlertTriangle, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { GUIDE_VERTICALS } from "@/lib/guide-verticals";
import { VERTICAL_ICONS } from "@/components/CreateGuideSteps";
import { Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type SubTab = "settings" | "queue" | "payouts" | "analytics";

// ── Kill switch toggle — uses shadcn Switch for correct rendering ──
function KillSwitch({ enabled, onChange, saving }: { enabled: boolean; onChange: (v: boolean) => void; saving: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-6 rounded-xl border-2 p-5 transition-all duration-200 ${
      enabled
        ? "border-green-500/60 bg-green-950/40"
        : "border-red-500/60 bg-red-950/40"
    }`}>
      <div className="flex-1">
        <p className={`font-bold text-lg ${enabled ? "text-green-400" : "text-red-400"}`}>
          Revenue Share {enabled ? "ENABLED" : "DISABLED"}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-lg">
          {enabled
            ? "Guide revenue attribution is active. Monthly payouts are being calculated."
            : "All payout calculations are paused. Enabling will resume tracking and prepare monthly payouts."}
        </p>
      </div>
      <Switch
        data-testid="toggle-revenue-share"
        checked={enabled}
        onCheckedChange={onChange}
        disabled={saving}
        className={`scale-[1.4] origin-right ${
          enabled
            ? "data-[state=checked]:bg-green-500"
            : "data-[state=unchecked]:bg-red-500"
        }`}
      />
    </div>
  );
}

// ── Slider input ───────────────────────────────────────────────
function SliderField({ label, value, min, max, step = 1, onChange, unit = "%" }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold text-primary">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Settings sub-tab ───────────────────────────────────────────
function SettingsTab() {
  const { toast } = useToast();
  const [poolPct, setPoolPct] = useState(20);
  const [minPayout, setMinPayout] = useState(25);
  const [minQuality, setMinQuality] = useState(70);
  const [minAccountAge, setMinAccountAge] = useState(30);
  const [autoApproveScore, setAutoApproveScore] = useState(85);
  const [revenueEnabled, setRevenueEnabled] = useState(false);

  const { data: existing } = useQuery<any>({
    queryKey: ["/api/guides/revenue-settings"],
    queryFn: () => apiRequest("GET", "/api/guides/revenue-settings").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", "/api/affiliate/admin/settings", payload).then(r => r.json()),
    onSuccess: () => toast({ title: "Settings saved" }),
    onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
  });

  const handleSave = () => {
    saveMutation.mutate({
      key: "revenue_share",
      value: { enabled: revenueEnabled, poolPct, minPayout, minQuality, minAccountAge, autoApproveScore },
    });
  };

  const handleToggle = (v: boolean) => {
    setRevenueEnabled(v);
    saveMutation.mutate({ key: "revenue_share", value: { enabled: v, poolPct, minPayout, minQuality, minAccountAge, autoApproveScore } });
  };

  return (
    <div className="space-y-6">
      <KillSwitch enabled={revenueEnabled} onChange={handleToggle} saving={saveMutation.isPending} />

      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
        <p className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle className="w-4 h-4" /> Important</p>
        <p className="text-xs text-amber-400/80">Enabling this will begin tracking guide revenue attribution and preparing monthly payouts. Disable to pause all payout calculations.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-6">
        <h3 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Pool Settings</h3>
        <SliderField label="Pool % — affiliate revenue shared with authors" value={poolPct} min={0} max={50} onChange={setPoolPct} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Minimum Payout ($)</label>
          <div className="flex items-center gap-2 max-w-[140px]">
            <span className="text-muted-foreground">$</span>
            <Input type="number" value={minPayout} onChange={e => setMinPayout(Number(e.target.value))} className="bg-secondary" data-testid="input-min-payout" />
          </div>
        </div>
        <SliderField label="Minimum Quality Score to qualify" value={minQuality} min={0} max={100} onChange={setMinQuality} unit="" />
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Minimum Account Age (days)</label>
          <Input type="number" value={minAccountAge} onChange={e => setMinAccountAge(Number(e.target.value))}
            className="bg-secondary max-w-[140px]" data-testid="input-min-account-age" />
        </div>
        <SliderField label="Auto-approve score threshold" value={autoApproveScore} min={70} max={100} onChange={setAutoApproveScore} unit="" />
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-revenue-settings" className="gap-2">
          {saveMutation.isPending ? "Saving..." : <><CheckCircle2 className="w-4 h-4" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}

// ── Monetization Queue sub-tab ─────────────────────────────────
function MonetizationQueueTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: guides, isLoading } = useQuery<any[]>({
    queryKey: ["/api/guides", { sortBy: "quality" }],
    queryFn: () => apiRequest("GET", "/api/guides?sortBy=quality&limit=50").then(r => r.json()),
  });

  const queue = guides?.filter((g: any) => (g.qualityScore ?? 0) >= 70 && !g.isMonetized) ?? [];

  const approveMutation = useMutation({
    mutationFn: ({ id, approved, notes }: { id: number; approved: boolean; notes?: string }) =>
      apiRequest("PATCH", `/api/affiliate/admin/guides/${id}/monetize`, { approved, notes }).then(r => r.json()),
    onSuccess: (_, vars) => {
      toast({ title: vars.approved ? "Guide approved for monetization!" : "Guide rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/guides"] });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  if (queue.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Queue is empty</p>
        <p className="text-sm mt-1">No guides awaiting monetization approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{queue.length} guide{queue.length !== 1 ? "s" : ""} awaiting review</p>
      {queue.map((guide: any) => {
        const vDef = GUIDE_VERTICALS.find(v => v.key === guide.vertical);
        const VIcon = vDef ? (VERTICAL_ICONS[vDef.icon] ?? Wrench) : Wrench;
        return (
          <div key={guide.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-extrabold text-lg">{guide.qualityScore ?? 0}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight line-clamp-1">{guide.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {vDef && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                        <VIcon className="w-2.5 h-2.5" /> {vDef.label}
                      </span>
                    )}
                    {guide.communityVerified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-2.5 h-2.5" /> Verified
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{guide.author?.displayName ?? guide.author?.username ?? "Unknown"}</span>
                  </div>
                </div>
              </div>
              {guide.signalCount !== undefined && (
                <p className="text-xs text-muted-foreground">Signals: {guide.signalCount}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline"
                onClick={() => approveMutation.mutate({ id: guide.id, approved: false })}
                disabled={approveMutation.isPending}
                data-testid={`button-reject-monetize-${guide.id}`}
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button size="sm"
                onClick={() => approveMutation.mutate({ id: guide.id, approved: true })}
                disabled={approveMutation.isPending}
                data-testid={`button-approve-monetize-${guide.id}`}
                className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Payouts sub-tab ────────────────────────────────────────────
function PayoutsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: payouts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/guide-revenue"],
    queryFn: () => apiRequest("GET", "/api/guide-revenue").then(r => r.json()),
  });

  const calcMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/affiliate/admin/calculate-payouts", { month: month + "-01" }).then(r => r.json()),
    onSuccess: (result) => {
      toast({ title: "Payouts calculated", description: `${result.payouts?.length ?? 0} guides in pool` });
      queryClient.invalidateQueries({ queryKey: ["/api/guide-revenue"] });
    },
    onError: () => toast({ title: "Error calculating payouts", variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (rowId: number) => apiRequest("PATCH", `/api/guide-revenue/${rowId}`, { status: "paid" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/guide-revenue"] }),
  });

  const exportCsv = () => {
    if (!payouts) return;
    const rows = [["Guide", "Author", "Month", "Clicks", "Amount", "Status"]];
    payouts.forEach((p: any) => rows.push([p.guideTitle ?? p.guideId, p.authorName ?? p.authorId, p.month, p.clickCount ?? 0, ((p.payoutCents ?? 0) / 100).toFixed(2), p.status]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payouts.csv"; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Calculate for month</label>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-secondary w-44" data-testid="input-payout-month" />
        </div>
        <Button onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending} data-testid="button-calculate-payouts" className="gap-2">
          {calcMutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Calculating...</> : <><DollarSign className="w-4 h-4" /> Calculate Payouts</>}
        </Button>
        <Button variant="outline" onClick={exportCsv} className="gap-2 ml-auto" data-testid="button-export-payouts-csv">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !payouts || payouts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No payout records yet</p>
          <p className="text-sm">Run a payout calculation to populate this table.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                {["Guide", "Author", "Month", "Clicks", "Payout", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((row: any) => (
                <tr key={row.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium line-clamp-1 max-w-[160px]">{row.guideTitle ?? `Guide #${row.guideId}`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.authorName ?? row.authorId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.month}</td>
                  <td className="px-4 py-3 text-right">{row.clickCount ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">${((row.payoutCents ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${
                      row.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                      row.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                      "bg-secondary text-muted-foreground border-border"
                    }`}>{row.status ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status !== "paid" && (
                      <Button size="sm" variant="ghost" onClick={() => markPaidMutation.mutate(row.id)}
                        data-testid={`button-mark-paid-${row.id}`} className="text-xs text-emerald-400 hover:text-emerald-300">
                        Mark Paid
                      </Button>
                    )}
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

// ── Analytics sub-tab ──────────────────────────────────────────
function AnalyticsTab() {
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/analytics"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/analytics").then(r => r.json()),
  });

  const { data: topGuides, isLoading: topLoading } = useQuery<any[]>({
    queryKey: ["/api/guides", { sortBy: "revenue" }],
    queryFn: () => apiRequest("GET", "/api/guides?sortBy=revenue&limit=10&isMonetized=true").then(r => r.json()),
  });

  const chartData = analytics?.monthly ?? [];

  return (
    <div className="space-y-6">
      {/* Lifetime stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Guides Monetized", value: analytics?.totalMonetized ?? "—", icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
          { label: "Revenue Attributed", value: analytics?.totalRevenue ? `$${(analytics.totalRevenue / 100).toFixed(2)}` : "—", icon: <DollarSign className="w-5 h-5 text-primary" /> },
          { label: "Payouts Made", value: analytics?.totalPayouts ? `$${(analytics.totalPayouts / 100).toFixed(2)}` : "—", icon: <Users className="w-5 h-5 text-blue-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-secondary shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-extrabold text-xl">{isLoading ? <Skeleton className="w-16 h-6 inline-block" /> : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Monthly Revenue &amp; Payouts</h3>
        {chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: any) => `$${(Number(v) / 100).toFixed(2)}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" dot={false} />
              <Line type="monotone" dataKey="payouts" stroke="#22c55e" strokeWidth={2} name="Payouts" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 10 guides */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Top Monetized Guides</h3>
        </div>
        {topLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                {["#", "Guide", "Author", "Revenue", "Score"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(topGuides ?? []).map((g: any, i: number) => (
                <tr key={g.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium line-clamp-1 max-w-[200px]">{g.title}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{g.author?.displayName ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-primary">${((g.attributedRevenue ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.qualityScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
const SUBTABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "queue", label: "Monetization Queue", icon: ListChecks },
  { id: "payouts", label: "Payouts", icon: DollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
];

export function RevenueShareAdminTab() {
  const [subTab, setSubTab] = useState<SubTab>("settings");

  return (
    <div>
      {/* Sub-tab nav */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {SUBTABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              data-testid={`revenue-subtab-${t.id}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors shrink-0 ${
                subTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {subTab === "settings" && <SettingsTab />}
      {subTab === "queue" && <MonetizationQueueTab />}
      {subTab === "payouts" && <PayoutsTab />}
      {subTab === "analytics" && <AnalyticsTab />}
    </div>
  );
}
