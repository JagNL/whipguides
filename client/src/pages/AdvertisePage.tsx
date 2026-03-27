/**
 * AdvertisePage — /advertise
 * Self-serve advertiser portal: onboarding, campaign creation, creative upload, dashboard.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, BarChart3, Plus, Pencil, Trash2, Eye,
  Target, DollarSign, Calendar, CheckCircle2,
  ArrowRight, ChevronRight, Users, Zap, TrendingUp, Globe,
  Pause, Play, AlertCircle, ExternalLink, Image as ImageIcon,
} from "lucide-react";
import { timeAgo, formatPrice } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  pending_review: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-muted text-muted-foreground border-border",
};

const VEHICLE_CATEGORIES = [
  "Cars", "Trucks", "ATVs", "Motorcycles", "Jet Skis",
  "Boats", "Snowmobiles", "UTVs", "Dirt Bikes", "Parts & Accessories",
];

const MAKES = [
  "Ford", "Chevrolet", "Toyota", "Honda", "Dodge", "Ram",
  "GMC", "Jeep", "Subaru", "BMW", "Mercedes-Benz", "Audi",
];

// ── Account Setup Step ────────────────────────────────────────
function AccountSetupStep({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ companyName: "", website: "", description: "" });

  const createAccount = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ads/account", form).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/account"] });
      onComplete();
      toast({ title: "Ad account created", description: "You're ready to create campaigns" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
          <Megaphone className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Set up your ad account</h2>
        <p className="text-muted-foreground text-sm">Reach millions of car enthusiasts, buyers, and sellers on WhipGuides.</p>
      </div>

      {/* Value props */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Target, label: "Precision targeting", desc: "By vehicle type, category, location" },
          { icon: TrendingUp, label: "Real-time stats", desc: "Impressions, clicks, spend" },
          { icon: Users, label: "Engaged audience", desc: "Active buyers & enthusiasts" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-muted/30 rounded-xl p-3 text-center space-y-1">
            <Icon className="w-5 h-5 text-primary mx-auto" />
            <p className="text-xs font-semibold">{label}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Company or business name *</Label>
          <Input
            placeholder="e.g. Texas Auto Parts, Smith's Garage"
            value={form.companyName}
            onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="https://yoursite.com"
            value={form.website}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>What do you sell/offer? <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            placeholder="Parts, accessories, repairs, dealership..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="resize-none text-sm"
          />
        </div>
        <Button
          className="w-full"
          disabled={!form.companyName.trim() || createAccount.isPending}
          onClick={() => createAccount.mutate()}
        >
          {createAccount.isPending ? "Creating..." : "Create Ad Account"}
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Campaign Creation Dialog ──────────────────────────────────
function CampaignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", objective: "awareness",
    budgetType: "daily", budgetAmount: "10", bidType: "cpm", bidAmount: "2.00",
    startDate: "", endDate: "",
    targetCategories: [] as string[],
    targetVehicleMakes: [] as string[],
    targetLocations: "",
  });

  const createCampaign = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ads/campaigns", {
      ...form,
      targetLocations: form.targetLocations ? form.targetLocations.split(",").map(s => s.trim()).filter(Boolean) : [],
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      toast({ title: "Campaign created", description: "Now add your ad creative" });
      onClose();
      setStep(1);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      targetCategories: f.targetCategories.includes(cat)
        ? f.targetCategories.filter(c => c !== cat)
        : [...f.targetCategories, cat],
    }));
  };

  const toggleMake = (make: string) => {
    setForm(f => ({
      ...f,
      targetVehicleMakes: f.targetVehicleMakes.includes(make)
        ? f.targetVehicleMakes.filter(m => m !== make)
        : [...f.targetVehicleMakes, make],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>Step {step} of 3</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-1.5 mb-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Campaign name *</Label>
              <Input
                placeholder="e.g. Summer Parts Sale, New Inventory Launch"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "awareness", label: "Awareness", icon: "📢", desc: "Maximize reach" },
                  { value: "traffic", label: "Traffic", icon: "🔗", desc: "Drive website visits" },
                  { value: "conversions", label: "Conversions", icon: "✅", desc: "Grow sales" },
                ].map(o => (
                  <button
                    key={o.value}
                    onClick={() => setForm(f => ({ ...f, objective: o.value }))}
                    className={`p-3 rounded-xl border text-center space-y-1 transition-all ${form.objective === o.value ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-primary/40"}`}
                  >
                    <div className="text-xl">{o.icon}</div>
                    <p className="text-xs font-semibold">{o.label}</p>
                    <p className="text-[10px] text-muted-foreground">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget type</Label>
                <Select value={form.budgetType} onValueChange={v => setForm(f => ({ ...f, budgetType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily budget</SelectItem>
                    <SelectItem value="total">Total budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Budget amount ($)</Label>
                <Input
                  type="number" min="1" step="1"
                  value={form.budgetAmount}
                  onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))}
                  placeholder="10.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bidding model</Label>
                <Select value={form.bidType} onValueChange={v => setForm(f => ({ ...f, bidType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpm">CPM (per 1k impressions)</SelectItem>
                    <SelectItem value="cpc">CPC (per click)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bid amount ($)</Label>
                <Input
                  type="number" min="0.10" step="0.10"
                  value={form.bidAmount}
                  onChange={e => setForm(f => ({ ...f, bidAmount: e.target.value }))}
                  placeholder="2.00"
                />
              </div>
            </div>

            <Button className="w-full" disabled={!form.name.trim()} onClick={() => setStep(2)}>
              Next: Targeting <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target vehicle categories <span className="text-muted-foreground text-xs">(empty = all)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {VEHICLE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${form.targetCategories.includes(cat) ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground hover:border-primary/30"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target vehicle makes <span className="text-muted-foreground text-xs">(empty = all)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {MAKES.map(make => (
                  <button
                    key={make}
                    onClick={() => toggleMake(make)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${form.targetVehicleMakes.includes(make) ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground hover:border-primary/30"}`}
                  >
                    {make}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Target locations <span className="text-muted-foreground text-xs">(comma-separated states/cities)</span></Label>
              <Input
                placeholder="Texas, California, Florida"
                value={form.targetLocations}
                onChange={e => setForm(f => ({ ...f, targetLocations: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objective</span>
                <span className="font-medium capitalize">{form.objective}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">${form.budgetAmount}/{form.budgetType === "daily" ? "day" : "total"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bidding</span>
                <span className="font-medium">${form.bidAmount} {form.bidType.toUpperCase()}</span>
              </div>
              {form.targetCategories.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categories</span>
                  <span className="font-medium text-right max-w-[200px]">{form.targetCategories.join(", ")}</span>
                </div>
              )}
              {form.targetLocations && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locations</span>
                  <span className="font-medium text-right max-w-[200px]">{form.targetLocations}</span>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">After creating the campaign, you'll add your ad creative. All ads are reviewed before going live.</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button
                className="flex-1"
                disabled={createCampaign.isPending}
                onClick={() => createCampaign.mutate()}
              >
                {createCampaign.isPending ? "Creating..." : "Create Campaign"}
                <CheckCircle2 className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Ad Creative Dialog ────────────────────────────────────────
function AdCreativeDialog({ campaignId, open, onClose }: { campaignId: number; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    headline: "", body: "", ctaText: "Learn More", ctaUrl: "", imageUrl: "",
  });

  const createAd = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/ads/campaigns/${campaignId}/ads`, {
        ...form,
        format: "feed_card",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      toast({ title: "Ad submitted for review", description: "We'll review it within 24 hours" });
      onClose();
      setForm({ headline: "", body: "", ctaText: "Learn More", ctaUrl: "", imageUrl: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Ad Creative</DialogTitle>
          <DialogDescription>Create the visual content for your ad. It will be reviewed before going live.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Headline * <span className="text-muted-foreground text-xs">(max 60 chars)</span></Label>
            <Input
              placeholder="Premium OEM Parts at Dealer Prices"
              maxLength={60}
              value={form.headline}
              onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground text-right">{form.headline.length}/60</p>
          </div>

          <div className="space-y-1.5">
            <Label>Body text <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              placeholder="Shop thousands of parts for all makes and models. Free shipping on orders over $50."
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={2}
              className="resize-none text-sm"
              maxLength={150}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Call to action</Label>
              <Select value={form.ctaText} onValueChange={v => setForm(f => ({ ...f, ctaText: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Learn More", "Shop Now", "Get Quote", "Visit Site", "View Inventory", "Contact Us"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination URL *</Label>
              <Input
                placeholder="https://yoursite.com"
                value={form.ctaUrl}
                onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Image URL <span className="text-muted-foreground text-xs">(optional — recommended 1200×628)</span></Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              />
            </div>
            {form.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border aspect-video">
                <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={() => setForm(f => ({ ...f, imageUrl: "" }))} />
              </div>
            )}
          </div>

          {/* Live preview */}
          {form.headline && (
            <div className="border border-dashed border-primary/30 rounded-xl p-3 space-y-2 bg-primary/5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 w-fit px-1.5 py-0.5 rounded">Sponsored</div>
              <p className="text-sm font-semibold">{form.headline}</p>
              {form.body && <p className="text-xs text-muted-foreground">{form.body}</p>}
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                {form.ctaText} <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!form.headline.trim() || !form.ctaUrl.trim() || createAd.isPending}
              onClick={() => createAd.mutate()}
            >
              {createAd.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function AdvertisePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showWizard, setShowWizard] = useState(false);
  const [adCampaignId, setAdCampaignId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: account, isLoading: accountLoading } = useQuery<any>({
    queryKey: ["/api/ads/account"],
    queryFn: () => apiRequest("GET", "/api/ads/account").then(r => r.json()),
    enabled: !!user,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/ads/campaigns"],
    queryFn: () => apiRequest("GET", "/api/ads/campaigns").then(r => r.json()),
    enabled: !!account,
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/ads/analytics"],
    queryFn: () => apiRequest("GET", "/api/ads/analytics?days=30").then(r => r.json()),
    enabled: !!account,
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ads/campaigns/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      toast({ title: "Campaign deleted" });
      setDeletingId(null);
    },
  });

  const pauseResumeCampaign = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/ads/campaigns/${id}`, { status }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      toast({ title: "Campaign updated" });
    },
  });

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <Megaphone className="w-12 h-12 text-primary mx-auto opacity-60" />
        <h1 className="text-2xl font-bold">Advertise on WhipGuides</h1>
        <p className="text-muted-foreground">Sign in to create your ad account and reach thousands of car enthusiasts.</p>
      </div>
    );
  }

  if (accountLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <AccountSetupStep onComplete={() => queryClient.invalidateQueries({ queryKey: ["/api/ads/account"] })} />
      </div>
    );
  }

  const totalImpressions = analytics?.totals?.impressions || 0;
  const totalClicks = analytics?.totals?.clicks || 0;
  const totalCtr = analytics?.totals?.ctr || "0.00";
  const totalSpend = analytics?.totals?.spend || "0.00";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{account.company_name}</h1>
          <p className="text-sm text-muted-foreground">Ad Account · {account.status === "active" ? "Active" : account.status}</p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Impressions (30d)", value: Number(totalImpressions).toLocaleString(), icon: Eye, color: "text-blue-400" },
          { label: "Clicks (30d)", value: Number(totalClicks).toLocaleString(), icon: Zap, color: "text-primary" },
          { label: "CTR (30d)", value: `${totalCtr}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Spend (30d)", value: `$${totalSpend}`, icon: DollarSign, color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Campaigns</h2>

        {campaignsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3">
            <Target className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground">Create your first campaign to start reaching WhipGuides users.</p>
            <Button onClick={() => setShowWizard(true)} className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" /> Create Campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign: any) => {
              const ads = campaign.ads || [];
              const totalImp = ads.reduce((s: number, a: any) => s + (a.impressions || 0), 0);
              const totalClk = ads.reduce((s: number, a: any) => s + (a.clicks || 0), 0);
              const budgetPct = Math.min(100, (campaign.spent_amount / campaign.budget_amount) * 100) || 0;

              return (
                <div key={campaign.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{campaign.name}</h3>
                        <Badge className={`text-[10px] border ${STATUS_STYLES[campaign.status] || STATUS_STYLES.draft}`}>
                          {campaign.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {campaign.objective} · ${campaign.budget_amount}/{campaign.budget_type === "daily" ? "day" : "total"} · {campaign.bid_type.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {campaign.status === "active" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => pauseResumeCampaign.mutate({ id: campaign.id, status: "paused" })}>
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {campaign.status === "paused" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => pauseResumeCampaign.mutate({ id: campaign.id, status: "pending_review" })}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary"
                        onClick={() => setAdCampaignId(campaign.id)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingId(campaign.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Stats mini row */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{ads.length} ad{ads.length !== 1 ? "s" : ""}</span>
                    <span>{totalImp.toLocaleString()} impressions</span>
                    <span>{totalClk.toLocaleString()} clicks</span>
                    <span>{totalImp > 0 ? ((totalClk / totalImp) * 100).toFixed(1) : "0.0"}% CTR</span>
                  </div>

                  {/* Budget bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Budget used</span>
                      <span>${campaign.spent_amount.toFixed(2)} / ${campaign.budget_amount}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Ads list */}
                  {ads.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {ads.map((ad: any) => (
                        <div key={ad.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <span className="truncate max-w-[200px] font-medium">{ad.headline}</span>
                          <Badge className={`text-[9px] border ${STATUS_STYLES[ad.status] || STATUS_STYLES.draft}`}>
                            {ad.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {ads.length === 0 && (
                    <button
                      className="mt-3 w-full border border-dashed border-primary/30 rounded-lg py-2 text-xs text-primary hover:bg-primary/5 transition-colors"
                      onClick={() => setAdCampaignId(campaign.id)}
                    >
                      + Add ad creative to start running
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Billing note */}
      <div className="bg-muted/20 border border-border rounded-xl p-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Billing:</strong> WhipGuides uses post-billing. You'll be invoiced for your actual spend at the end of each billing cycle. Contact <a href="mailto:ads@whipguides.com" className="text-primary hover:underline">ads@whipguides.com</a> for enterprise pricing or custom packages.</p>
      </div>

      {/* Dialogs */}
      <CampaignWizard open={showWizard} onClose={() => setShowWizard(false)} />
      {adCampaignId !== null && (
        <AdCreativeDialog campaignId={adCampaignId} open={true} onClose={() => setAdCampaignId(null)} />
      )}

      {/* Delete confirm */}
      {deletingId !== null && (
        <Dialog open={true} onOpenChange={() => setDeletingId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete campaign?</DialogTitle>
              <DialogDescription>This will permanently delete the campaign and all its ads. This can't be undone.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                disabled={deleteCampaign.isPending}
                onClick={() => deleteCampaign.mutate(deletingId)}
              >
                {deleteCampaign.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
