import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldPlus, Users } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────
function roleBadge(role: string) {
  if (role === "super_admin") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  if (role === "site_admin") return "bg-primary/15 text-primary border-primary/30";
  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

function roleLabel(role: string) {
  if (role === "super_admin") return "⚡ Super Admin";
  if (role === "site_admin") return "🛡 Site Admin";
  return "User";
}

// ─── Permissions Editor Dialog ────────────────────────────────
function PermissionsEditor({
  admin, catalogue, open, onClose,
}: {
  admin: any;
  catalogue: any;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  // Initialize from admin's existing permissions
  useEffect(() => {
    if (open && admin) {
      setPerms(admin.admin_permissions || {});
    }
  }, [open, admin]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/affiliate/admin/admins/${admin.id}/permissions`, { permissions: perms }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Permissions saved" });
      onClose();
    },
    onError: () => toast({ title: "Error saving permissions", variant: "destructive" }),
  });

  function applyTemplate(templateKey: string) {
    const template = catalogue?.templates?.[templateKey];
    if (!template) return;
    setPerms(template);
  }

  const templates: Record<string, string> = catalogue?.templateLabels || {
    content_moderator: "Content Moderator",
    ads_manager: "Ads Manager",
    community_manager: "Community Manager",
    guide_curator: "Guide Curator",
    super_admin: "Super Admin",
    site_admin: "Site Admin",
  };

  const domains: Array<{ key: string; label: string; permissions: Array<{ key: string; label: string; description?: string }> }> =
    catalogue?.domains || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Permissions for {admin?.display_name || admin?.username}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Template quick-apply */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Apply Template</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(templates).map(([key, label]) => (
                <button key={key} type="button"
                  onClick={() => applyTemplate(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  data-testid={`template-${key}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Permission list by domain */}
          {domains.length > 0 ? (
            <div className="space-y-5">
              {domains.map(domain => (
                <div key={domain.key}>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                    {domain.label}
                  </p>
                  <div className="space-y-2 pl-3">
                    {domain.permissions.map(perm => (
                      <div key={perm.key} className="flex items-start gap-3 py-1.5 rounded-lg hover:bg-secondary/30 px-2 transition-colors">
                        <Switch
                          id={`perm-${perm.key}`}
                          checked={!!perms[perm.key]}
                          onCheckedChange={v => setPerms(p => ({ ...p, [perm.key]: v }))}
                          data-testid={`switch-perm-${perm.key}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={`perm-${perm.key}`} className="text-sm font-medium cursor-pointer">{perm.label}</Label>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Fallback: flat permission keys from perms if no catalogue domains
            <div className="space-y-2">
              {Object.keys(perms).map(key => (
                <div key={key} className="flex items-center gap-3 py-1.5 px-2">
                  <Switch
                    id={`perm-${key}`}
                    checked={!!perms[key]}
                    onCheckedChange={v => setPerms(p => ({ ...p, [key]: v }))}
                    className="shrink-0"
                  />
                  <Label htmlFor={`perm-${key}`} className="text-sm capitalize cursor-pointer">{key.replace(/_/g, " ")}</Label>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              data-testid="btn-save-permissions">
              {saveMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Card ──────────────────────────────────────────────
function AdminCard({ admin, catalogue, onEdit }: { admin: any; catalogue: any; onEdit: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={admin.avatar} />
        <AvatarFallback className="bg-primary/20 text-primary text-sm">
          {(admin.display_name || admin.username || "?")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{admin.display_name || admin.username}</span>
          <Badge className={`text-[10px] border ${roleBadge(admin.site_role)}`}>{roleLabel(admin.site_role)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">@{admin.username}</p>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={onEdit} data-testid={`btn-edit-perms-${admin.id}`}>
        <ShieldPlus className="w-3.5 h-3.5" /> Edit Permissions
      </Button>
    </div>
  );
}

// ─── Main PermissionsAdminTab ─────────────────────────────────
export function PermissionsAdminTab() {
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: adminsData, isLoading: adminsLoading } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/admins"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/admins").then(r => r.json()),
  });

  const { data: catalogueData, isLoading: catalogueLoading } = useQuery<any>({
    queryKey: ["/api/affiliate/admin/permissions-catalogue"],
    queryFn: () => apiRequest("GET", "/api/affiliate/admin/permissions-catalogue").then(r => r.json()),
  });

  const admins: any[] = adminsData?.admins || [];
  const catalogue = catalogueData || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div>
          <h2 className="text-display text-lg font-extrabold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Admin Permissions
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Only the platform owner can modify permissions</p>
        </div>
      </div>

      {/* Admins list */}
      {adminsLoading || catalogueLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No admins yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin: any) => (
            <AdminCard key={admin.id} admin={admin} catalogue={catalogue} onEdit={() => setEditTarget(admin)} />
          ))}
        </div>
      )}

      {/* Permissions editor dialog */}
      {editTarget && (
        <PermissionsEditor
          admin={editTarget}
          catalogue={catalogue}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

export default PermissionsAdminTab;
