import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Tag, Flag, BarChart3,
  Ban, CheckCircle, Star, Trash2, Search,
  ShieldCheck, Activity, ChevronLeft, ChevronRight,
  Eye, AlertTriangle, Megaphone, Filter, CheckCircle2,
  XCircle, Pause, Play, Plus, Key, Globe, Video, ToggleLeft, ToggleRight,
  Link2, KeyRound, DollarSign, Brain, ShieldPlus, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Package, TrendingUp, Zap,
} from "lucide-react";
import { AffiliateAdminTab } from "@/components/AffiliateAdminTab";
import { PermissionsAdminTab } from "@/components/PermissionsAdminTab";
import { useAppConfig } from "@/hooks/use-cf-url";
import { timeAgo } from "@/lib/utils";

type AdminTab = "overview" | "users" | "listings" | "reports" | "groups" | "ads" | "moderation" | "keywords" | "audit" | "video" | "affiliate" | "permissions";

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = "text-primary", urgent = false }: any) {
  return (
    <div className={`bg-card rounded-xl border p-5 ${urgent ? "border-destructive/40" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`w-5 h-5 ${urgent ? "text-destructive" : color}`} />
      </div>
      <p className={`text-display text-3xl font-extrabold ${urgent ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then(r => r.json()),
  });

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length: 6}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl"/>)}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers?.toLocaleString()} icon={Users} />
        <StatCard label="Active Listings" value={stats?.activeListings?.toLocaleString()} icon={Tag} />
        <StatCard label="Total Groups" value={stats?.totalGroups?.toLocaleString()} icon={Shield} />
        <StatCard label="Pending Reports" value={stats?.pendingReports?.toLocaleString()} icon={Flag} urgent={stats?.pendingReports > 0} />
        <StatCard label="Banned Users" value={stats?.bannedUsers?.toLocaleString()} icon={Ban} color="text-destructive" />
        <StatCard label="Total Listings" value={stats?.totalListings?.toLocaleString()} icon={BarChart3} />
      </div>
      {stats?.pendingReports > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="font-semibold text-sm">Action Required</p>
            <p className="text-xs text-muted-foreground">{stats.pendingReports} pending report{stats.pendingReports !== 1 ? "s" : ""} need review.</p>
          </div>
          <Button size="sm" variant="destructive" className="ml-auto shrink-0" onClick={() => {}}>View Reports</Button>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────
function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/users", search, page],
    queryFn: () => apiRequest("GET", `/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`).then(r => r.json()),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/ban`, { reason }).then(r => r.json()),
    onSuccess: () => { toast({ title: "User banned" }); refetch(); setBanTarget(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/unban`, {}).then(r => r.json()),
    onSuccess: () => { toast({ title: "User unbanned" }); refetch(); },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/role`, { role }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Role updated" }); refetch(); },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, verified }: { id: number; verified: boolean }) =>
      apiRequest("POST", `/api/admin/users/${id}/verify`, { verified }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Verification updated" }); refetch(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Badge variant="outline" className="h-9 px-3 flex items-center">
          {data?.total ?? 0} users
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-16 rounded-xl"/>)}</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Joined</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.users || []).map((user: any) => (
                <tr key={user.id} className={`hover:bg-secondary/30 transition-colors ${user.banned ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="text-xs">{user.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{user.display_name}</span>
                          {user.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                          {user.banned && <Badge variant="destructive" className="text-xs py-0">Banned</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">@{user.username} · {user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className={
                      user.site_role === "super_admin" ? "border-yellow-500/40 text-yellow-400" :
                      user.site_role === "site_admin" ? "border-primary/40 text-primary" :
                      "text-muted-foreground"
                    }>
                      {user.site_role === "super_admin" ? "⚡ Super Admin" :
                       user.site_role === "site_admin" ? "🛡 Admin" : "User"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {timeAgo(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {/* Verify toggle */}
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => verifyMutation.mutate({ id: user.id, verified: !user.verified })}>
                        {user.verified
                          ? <><CheckCircle className="w-3.5 h-3.5 text-primary" /> Verified</>
                          : <><Star className="w-3.5 h-3.5" /> Verify</>}
                      </Button>
                      {/* Role toggle (super admin only) */}
                      {isSuperAdmin && user.site_role !== "super_admin" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                          onClick={() => roleMutation.mutate({ id: user.id, role: user.site_role === "site_admin" ? "user" : "site_admin" })}>
                          <Shield className="w-3.5 h-3.5" />
                          {user.site_role === "site_admin" ? "Demote" : "Make Admin"}
                        </Button>
                      )}
                      {/* Ban toggle */}
                      {user.site_role !== "super_admin" && (
                        user.banned ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-500/30 text-green-400"
                            onClick={() => unbanMutation.mutate(user.id)}>
                            <CheckCircle className="w-3.5 h-3.5" /> Unban
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/30 text-destructive"
                            onClick={() => setBanTarget(user)}>
                            <Ban className="w-3.5 h-3.5" /> Ban
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data?.total > 25 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 25)}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / 25)} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Ban dialog */}
      <AlertDialog open={!!banTarget} onOpenChange={() => setBanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban @{banTarget?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent them from logging in. You can unban at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Reason (optional)" value={banReason} onChange={e => setBanReason(e.target.value)} className="my-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => banMutation.mutate({ id: banTarget.id, reason: banReason })}>
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────
function ReportsTab() {
  const [activeStatus, setActiveStatus] = useState("pending");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/reports", activeStatus],
    queryFn: () => apiRequest("GET", `/api/admin/reports?status=${activeStatus}`).then(r => r.json()),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status, resolution }: any) =>
      apiRequest("PATCH", `/api/admin/reports/${id}`, { status, resolution }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Report updated" }); refetch(); },
  });

  const REASON_LABELS: Record<string, string> = {
    spam: "Spam", fraud: "Fraud", inappropriate: "Inappropriate",
    illegal_item: "Illegal Item", harassment: "Harassment",
    misinformation: "Misinformation", other: "Other",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["pending", "reviewed", "resolved", "dismissed"].map(s => (
          <button key={s} onClick={() => setActiveStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
      ) : (data?.reports || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No {activeStatus} reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.reports || []).map((report: any) => (
            <div key={report.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{report.target_type}</Badge>
                    <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                      {REASON_LABELS[report.reason] || report.reason}
                    </Badge>
                    <span className="text-xs text-muted-foreground">#{report.target_id}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(report.created_at)}</span>
                  </div>
                  {report.description && (
                    <p className="text-sm text-muted-foreground mt-1">"{report.description}"</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Reported by @{report.reporter?.username}
                  </p>
                </div>
                {activeStatus === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-400"
                      onClick={() => resolveMutation.mutate({ id: report.id, status: "resolved", resolution: "Action taken" })}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                      onClick={() => resolveMutation.mutate({ id: report.id, status: "dismissed", resolution: "No violation found" })}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listings Tab ────────────────────────────────────────────
function ListingsTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/listings", search, page],
    queryFn: () => apiRequest("GET", `/api/admin/listings?search=${encodeURIComponent(search)}&page=${page}`).then(r => r.json()),
  });

  const featureMutation = useMutation({
    mutationFn: ({ id, featured }: any) =>
      apiRequest("POST", `/api/admin/listings/${id}/feature`, { featured }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Listing updated" }); refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/listings/${id}`, { reason: "Admin removal" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Listing removed" }); refetch(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search listings..." className="pl-9" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-14 rounded-xl"/>)}</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Listing</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Seller</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Price</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.listings || []).map((listing: any) => (
                <tr key={listing.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {listing.featured && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />}
                      <span className="font-medium line-clamp-1">{listing.title}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{listing.category}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    @{listing.users?.username}
                  </td>
                  <td className="px-4 py-3 font-semibold hidden lg:table-cell">
                    ${listing.price?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => featureMutation.mutate({ id: listing.id, featured: !listing.featured })}>
                        <Star className={`w-3.5 h-3.5 ${listing.featured ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        {listing.featured ? "Unfeature" : "Feature"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1"
                        onClick={() => deleteMutation.mutate(listing.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.total > 25 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 25)}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / 25)} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Groups Tab ─────────────────────────────────────────────
function GroupsTab() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/groups"],
    queryFn: () => apiRequest("GET", "/api/admin/groups").then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/groups/${id}`, { reason: "Admin removal" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Group deleted" }); refetch(); },
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
      ) : (data?.groups || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No groups yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Group</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Members</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.groups || []).map((g: any) => (
                <tr key={g.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      {g.is_private && <Badge variant="outline" className="text-[10px]">Private</Badge>}
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{g.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    @{g.owner?.username}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {g.member_count || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1"
                      onClick={() => deleteMutation.mutate(g.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
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

// ─── Audit Log Tab ───────────────────────────────────────────
function AuditTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/audit"],
    queryFn: () => apiRequest("GET", "/api/admin/audit").then(r => r.json()),
  });

  const ACTION_LABELS: Record<string, string> = {
    ban_user: "Banned user", unban_user: "Unbanned user",
    delete_listing: "Removed listing", feature_listing: "Featured listing",
    set_role_site_admin: "Promoted to Admin", set_role_user: "Demoted to User",
    delete_group: "Deleted group",
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-14 rounded-xl"/>)
      ) : (data?.actions || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No admin actions yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Admin</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Target</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.actions || []).map((action: any) => (
                <tr key={action.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{ACTION_LABELS[action.action] || action.action}</span>
                    {action.notes && <p className="text-xs text-muted-foreground mt-0.5">"{action.notes}"</p>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    @{action.admin?.username}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {action.target_type} #{action.target_id}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {timeAgo(action.created_at)}
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

// ─── Main Admin Page ─────────────────────────────────────────
export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const { data: adminCheck, isLoading: checkLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then(r => r.json()),
    retry: false,
    enabled: isAuthenticated,
  });

  const isSuperAdmin = (user as any)?.siteRole === "super_admin" ||
    user?.username === "todd" || // fallback — email check happens server-side
    false;

  if (authLoading || checkLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">{Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl"/>)}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-display text-2xl font-extrabold mb-2">Admin Access</h2>
        <p className="text-muted-foreground mb-6">Sign in with an admin account to continue.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  if (adminCheck?.error) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-display text-2xl font-extrabold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6">You don't have admin permissions.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: any; superOnly?: boolean }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "listings", label: "Listings", icon: Tag },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "groups", label: "Groups", icon: Shield },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "moderation", label: "Moderation", icon: Filter },
    { id: "keywords", label: "Keywords", icon: Key },
    { id: "audit", label: "Audit Log", icon: Activity, superOnly: true },
    { id: "video", label: "Video", icon: Video, superOnly: true },
    { id: "affiliate", label: "Affiliate & AI", icon: Link2, superOnly: true },
    { id: "permissions", label: "Permissions", icon: KeyRound, superOnly: true },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-display text-2xl font-extrabold">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin ? "⚡ Super Admin" : "🛡 Site Admin"} · Signed in as @{user?.username}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-border">
        {tabs.filter(t => !t.superOnly || isSuperAdmin).map(tab => (
          <button
            key={tab.id}
            data-testid={`admin-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px shrink-0 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "users" && <UsersTab isSuperAdmin={isSuperAdmin} />}
      {activeTab === "listings" && <ListingsTab />}
      {activeTab === "reports" && <ReportsTab />}
      {activeTab === "groups" && <GroupsTab />}
      {activeTab === "ads" && <AdsTab />}
      {activeTab === "moderation" && <ModerationTab />}
      {activeTab === "keywords" && <KeywordsTab />}
      {activeTab === "audit" && <AuditTab />}
      {activeTab === "video" && <VideoAdminTab />}
      {activeTab === "affiliate" && <AffiliateAdminTab />}
      {activeTab === "permissions" && <PermissionsAdminTab />}
    </div>
  );
}

// ─── Video Admin Tab ──────────────────────────────────────────
function VideoAdminTab() {
  const { toast } = useToast();
  const config = useAppConfig();

  const { data: providerInfo, isLoading } = useQuery<any>({
    queryKey: ["/api/video/provider-info"],
    queryFn: () => apiRequest("GET", "/api/video/provider-info").then(r => r.json()),
  });

  const setEnvNote = (key: string, value: string) => (
    `Set ${key}=${value} in Railway environment variables and redeploy.`
  );

  type KillSwitch = { key: string; label: string; desc: string; current: boolean };
  const switches: KillSwitch[] = [
    {
      key: "VIDEO_ENABLED",
      label: "All Video Uploads",
      desc: "Master kill switch. Disabling this turns off all video globally.",
      current: config.videoEnabled,
    },
    {
      key: "VIDEO_GROUP_ENABLED",
      label: "Group Post Videos",
      desc: "Allow members to attach videos to group posts (max 90 sec).",
      current: config.videoGroupEnabled,
    },
    {
      key: "VIDEO_LISTING_ENABLED",
      label: "Listing Walk-Around Videos",
      desc: "Allow sellers to attach a walk-around video to marketplace listings (max 60 sec).",
      current: config.videoListingEnabled,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Provider status */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold text-base mb-4 flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" /> Video Provider
        </h2>
        {isLoading ? (
          <div className="animate-pulse h-16 bg-secondary rounded-lg" />
        ) : providerInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary rounded-xl">
              <div>
                <p className="text-sm font-semibold">{providerInfo.name}</p>
                <p className="text-xs text-muted-foreground">Current video provider</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                providerInfo.configured
                  ? "bg-green-500/15 text-green-400"
                  : "bg-yellow-500/15 text-yellow-400"
              }`}>
                {providerInfo.configured ? "Configured" : "Not configured (dev mode)"}
              </span>
            </div>
            {!providerInfo.configured && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Provider not configured</p>
                  <p>To enable Cloudflare Stream, add these Railway env vars:</p>
                  <code className="block mt-1 font-mono bg-black/30 px-2 py-1 rounded">
                    CF_ACCOUNT_ID=your_account_id<br />
                    CF_STREAM_TOKEN=your_stream_api_token
                  </code>
                  <p className="mt-1">Alternatively, set <code>VIDEO_PROVIDER=mux</code> and add Mux credentials when switching providers.</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-xs">
              {Object.entries(providerInfo.limits || {}).map(([ctx, lim]: [string, any]) => (
                <div key={ctx} className="bg-secondary rounded-lg p-3">
                  <p className="font-semibold capitalize mb-1">{ctx}</p>
                  <p className="text-muted-foreground">Max {lim.maxSeconds}s</p>
                  <p className="text-muted-foreground">{Math.round(lim.maxBytes / 1024 / 1024)} MB limit</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load provider info.</p>
        )}
      </div>

      {/* Kill switches */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold text-base mb-1 flex items-center gap-2">
          <ToggleLeft className="w-4 h-4 text-primary" /> Kill Switches
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          These are controlled via Railway environment variables. Changes require a redeploy.
        </p>
        <div className="space-y-3">
          {switches.map(sw => (
            <div key={sw.key} className="flex items-start justify-between gap-4 p-4 bg-secondary rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  {sw.label}
                  {sw.current
                    ? <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-bold">ENABLED</span>
                    : <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-bold">DISABLED</span>
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{sw.desc}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                  To {sw.current ? "disable" : "enable"}: set {sw.key}={sw.current ? "false" : "true"} in Railway
                </p>
              </div>
              <div className={`shrink-0 mt-0.5 ${sw.current ? "text-green-400" : "text-red-400"}`}>
                {sw.current
                  ? <ToggleRight className="w-7 h-7" />
                  : <ToggleLeft className="w-7 h-7" />}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">How to toggle a kill switch</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Go to Railway → Your Project → Variables</li>
            <li>Set the env var shown above (e.g. <code>VIDEO_ENABLED=false</code>)</li>
            <li>Railway will auto-redeploy. Kill switch activates instantly after deploy.</li>
            <li>To re-enable: set the var to <code>true</code> or delete it (defaults to enabled).</li>
          </ol>
        </div>
      </div>

      {/* Switching providers */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold text-base mb-2">Switching Video Providers</h2>
        <p className="text-xs text-muted-foreground mb-3">
          The video system is provider-agnostic. To switch (e.g. to Mux or Bunny Stream):
        </p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal ml-4">
          <li>Edit <code>server/video-provider.ts</code> — implement the <code>VideoProvider</code> interface for the new provider</li>
          <li>Add a new entry in <code>getVideoProvider()</code> factory function</li>
          <li>Set <code>VIDEO_PROVIDER=mux</code> (or your provider name) in Railway env vars</li>
          <li>Add the provider's API credentials as env vars</li>
          <li>Redeploy — clients are untouched, they only talk to <code>/api/video</code></li>
        </ol>
      </div>
    </div>
  );
}

// ─── Ads Tab ─────────────────────────────────────────────────
function AdsTab() {
  const { toast } = useToast();
  const [adStatus, setAdStatus] = useState("pending_review");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/ads", adStatus],
    queryFn: () => apiRequest("GET", `/api/admin/ads?status=${adStatus}`).then(r => r.json()),
  });

  const { data: revenue } = useQuery<any>({
    queryKey: ["/api/admin/ads/revenue"],
    queryFn: () => apiRequest("GET", "/api/admin/ads/revenue").then(r => r.json()),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/ads/${id}/approve`).then(r => r.json()),
    onSuccess: () => { refetch(); toast({ title: "Ad approved and set live" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/admin/ads/${id}/reject`, { reason }).then(r => r.json()),
    onSuccess: () => {
      refetch();
      setRejectId(null);
      setRejectReason("");
      toast({ title: "Ad rejected" });
    },
  });

  const pauseMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/ads/${id}/pause`).then(r => r.json()),
    onSuccess: () => { refetch(); toast({ title: "Ad paused" }); },
  });

  const STATUS_STYLES: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    paused: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    pending_review: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    draft: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      {/* Revenue stats */}
      {revenue && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Ad Accounts", value: revenue.totalAdAccounts, icon: Users },
            { label: "Active Campaigns", value: revenue.activeAds, icon: Megaphone },
            { label: "Pending Review", value: revenue.pendingAdsReview, icon: Eye, urgent: revenue.pendingAdsReview > 0 },
            { label: "Est. Revenue", value: `$${revenue.estimatedRevenue}`, icon: BarChart3 },
          ].map(({ label, value, icon: Icon, urgent = false }) => (
            <div key={label} className={`bg-card border rounded-xl p-4 ${urgent ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`w-4 h-4 ${urgent ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["pending_review", "active", "paused", "rejected"].map(s => (
          <button
            key={s}
            onClick={() => setAdStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              adStatus === s ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
      ) : (data?.ads || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No ads with status: {adStatus.replace(/_/g, " ")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.ads || []).map((ad: any) => (
            <div key={ad.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                {/* Image preview */}
                {(ad.image_id || ad.image_url) && (
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                    <img
                      src={ad.image_url || `#`}
                      alt={ad.headline}
                      className="w-full h-full object-cover"
                      onError={(e: any) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{ad.headline}</span>
                        <Badge className={`text-[9px] border ${STATUS_STYLES[ad.status] || STATUS_STYLES.draft}`}>
                          {ad.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {ad.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ad.body}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{ad.account?.company_name}</span>
                        <span>·</span>
                        <span>{ad.campaign?.name}</span>
                        <span>·</span>
                        <a href={ad.cta_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                          {ad.cta_text} <Globe className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  {ad.status === "pending_review" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={approveMut.isPending}
                        onClick={() => approveMut.mutate(ad.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setRejectId(ad.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {ad.status === "active" && (
                    <Button size="sm" variant="outline" className="h-7 mt-2"
                      onClick={() => pauseMut.mutate(ad.id)}>
                      <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                    </Button>
                  )}
                  {ad.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">Rejected: {ad.rejection_reason}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      {rejectId !== null && (
        <Dialog open={true} onOpenChange={() => { setRejectId(null); setRejectReason(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Reject ad</DialogTitle>
              <DialogDescription>Provide a reason so the advertiser knows what to fix.</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="e.g. Image is missing, URL leads to unsupported content..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate({ id: rejectId, reason: rejectReason })}
              >
                {rejectMut.isPending ? "Rejecting..." : "Reject Ad"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Content Moderation Tab ───────────────────────────────────
function ModerationTab() {
  const { toast } = useToast();
  const [flagStatus, setFlagStatus] = useState("pending");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/ads/flags", flagStatus],
    queryFn: () => apiRequest("GET", `/api/admin/ads/flags?status=${flagStatus}`).then(r => r.json()),
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery<any>({
    queryKey: ["/api/admin/reports", "pending"],
    queryFn: () => apiRequest("GET", "/api/admin/reports?status=pending").then(r => r.json()),
  });

  const updateFlag = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/admin/ads/flags/${id}`, { status, notes }).then(r => r.json()),
    onSuccess: () => { refetch(); toast({ title: "Flag updated" }); },
  });

  const updateReport = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/admin/reports/${id}`, { status, resolution: "reviewed" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report resolved" });
    },
  });

  const REASON_COLORS: Record<string, string> = {
    keyword_match: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    user_report: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    ai_flag: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    manual: "text-muted-foreground bg-muted/30 border-border",
  };

  return (
    <div className="space-y-8">
      {/* Auto-flagged content */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Auto-Flagged Content</h3>
          <div className="flex gap-1.5">
            {["pending", "reviewed", "dismissed", "actioned"].map(s => (
              <button key={s} onClick={() => setFlagStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  flagStatus === s ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (data?.flags || []).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No flagged content with status: {flagStatus}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.flags || []).map((flag: any) => (
              <div key={flag.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{flag.content_type} #{flag.content_id}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${REASON_COLORS[flag.reason] || REASON_COLORS.manual}`}>
                        {flag.reason.replace(/_/g, " ")}
                      </span>
                      {flag.keyword && (
                        <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded">
                          keyword: "{flag.keyword}"
                        </span>
                      )}
                    </div>
                    {flag.auto_action && (
                      <p className="text-xs text-muted-foreground">Auto action: <span className="text-foreground">{flag.auto_action}</span></p>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(flag.created_at)}</p>
                  </div>
                  {flag.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => updateFlag.mutate({ id: flag.id, status: "dismissed" })}>
                        Dismiss
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
                        onClick={() => updateFlag.mutate({ id: flag.id, status: "actioned" })}>
                        Action
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User-submitted reports */}
      <div>
        <h3 className="font-semibold mb-3">User Reports</h3>
        {reportsLoading ? (
          Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (reportsData?.reports || []).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending user reports</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(reportsData?.reports || []).map((report: any) => (
              <div key={report.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{report.target_type} #{report.target_id}</span>
                      <span className="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        {report.reason?.replace(/_/g, " ")}
                      </span>
                    </div>
                    {report.description && <p className="text-xs text-muted-foreground line-clamp-2">{report.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      Reported by @{report.reporter?.username} · {timeAgo(report.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => updateReport.mutate({ id: report.id, status: "dismissed" })}>
                      Dismiss
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
                      onClick={() => updateReport.mutate({ id: report.id, status: "resolved" })}>
                      Resolve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Keywords Tab ─────────────────────────────────────────────
function KeywordsTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newKw, setNewKw] = useState({ keyword: "", matchType: "contains", action: "flag", appliesTo: ["listing", "post", "ad"] });

  const { data: keywords = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/ads/keywords"],
    queryFn: () => apiRequest("GET", "/api/admin/ads/keywords").then(r => r.json()),
  });

  const addKeyword = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/ads/keywords", newKw).then(r => r.json()),
    onSuccess: () => {
      refetch();
      setShowAdd(false);
      setNewKw({ keyword: "", matchType: "contains", action: "flag", appliesTo: ["listing", "post", "ad"] });
      toast({ title: "Keyword added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteKeyword = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/ads/keywords/${id}`).then(r => r.json()),
    onSuccess: () => { refetch(); toast({ title: "Keyword removed" }); },
  });

  const ACTION_STYLES: Record<string, string> = {
    flag: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    block: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    auto_reject: "bg-destructive/15 text-destructive border-destructive/30",
  };

  const toggleAppliesTo = (type: string) => {
    setNewKw(k => ({
      ...k,
      appliesTo: k.appliesTo.includes(type)
        ? k.appliesTo.filter(t => t !== type)
        : [...k.appliesTo, type],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Keyword Blocklist</h3>
          <p className="text-sm text-muted-foreground">Keywords that trigger automatic flagging or blocking of content.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Keyword
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Keyword *</Label>
              <Input
                placeholder="e.g. stolen, scam"
                value={newKw.keyword}
                onChange={e => setNewKw(k => ({ ...k, keyword: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Match type</Label>
              <Select value={newKw.matchType} onValueChange={v => setNewKw(k => ({ ...k, matchType: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact match</SelectItem>
                  <SelectItem value="starts_with">Starts with</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <div className="flex gap-2">
              {["flag", "block", "auto_reject"].map(a => (
                <button key={a} onClick={() => setNewKw(k => ({ ...k, action: a }))}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    newKw.action === a ? ACTION_STYLES[a] : "bg-muted/40 border-border text-muted-foreground"
                  }`}>
                  {a.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Applies to</Label>
            <div className="flex gap-2">
              {["listing", "post", "ad"].map(t => (
                <button key={t} onClick={() => toggleAppliesTo(t)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    newKw.appliesTo.includes(t) ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-border text-muted-foreground"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!newKw.keyword.trim() || addKeyword.isPending}
              onClick={() => addKeyword.mutate()}>
              {addKeyword.isPending ? "Adding..." : "Add Keyword"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)
      ) : keywords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No keywords yet. Add some to protect the community.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Keyword</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Match</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Applies to</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((kw: any) => (
                <tr key={kw.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-sm">{kw.keyword}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell capitalize">{kw.match_type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ACTION_STYLES[kw.action] || "bg-muted text-muted-foreground border-border"}`}>
                      {kw.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {(kw.applies_to || []).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteKeyword.mutate(kw.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
