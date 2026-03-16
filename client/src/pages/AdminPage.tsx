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
  Eye, AlertTriangle,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

type AdminTab = "overview" | "users" | "listings" | "reports" | "groups" | "audit";

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
    { id: "audit", label: "Audit Log", icon: Activity, superOnly: true },
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
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
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
      {activeTab === "audit" && <AuditTab />}
    </div>
  );
}
