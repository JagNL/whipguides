import { Router, type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "./supabase";
import { storage } from "./storage";
import { requireAuth, requireMFA } from "./auth";

// ============================================================
// SUPER ADMIN EMAIL — set via environment variable
// This is the ultimate fallback that can never be changed via UI
// ============================================================
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "todd.englerth@gmail.com")
  .split(",")
  .map(e => e.trim().toLowerCase());

export function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

// ============================================================
// MIDDLEWARE
// ============================================================

// Requires site_admin or super_admin role
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authUser = (req as any).authUser;
  const currentUser = (req as any).currentUser;

  if (!authUser || !currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check email-based super admin first
  if (isSuperAdminEmail(authUser.email)) {
    (req as any).isSuperAdmin = true;
    return next();
  }

  // Check DB role
  if (currentUser.siteRole === "site_admin" || currentUser.siteRole === "super_admin") {
    (req as any).isSuperAdmin = currentUser.siteRole === "super_admin";
    return next();
  }

  return res.status(403).json({ error: "Admin access required" });
}

// Requires super_admin only
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authUser = (req as any).authUser;
  const currentUser = (req as any).currentUser;

  if (!authUser || !currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (isSuperAdminEmail(authUser.email) || currentUser.siteRole === "super_admin") {
    return next();
  }

  return res.status(403).json({ error: "Super admin access required" });
}

// ============================================================
// ADMIN API ROUTER
// All routes require requireAuth + requireAdmin
// ============================================================
export const adminRouter = Router();
adminRouter.use(requireAuth, requireMFA, requireAdmin);

// ── Dashboard stats ──────────────────────────────────────────
adminRouter.get("/stats", async (req, res) => {
  const [users, listings, groups, reports] = await Promise.all([
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("groups").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const [activeListings, bannedUsers] = await Promise.all([
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("banned", true),
  ]);

  const currentUser = (req as any).currentUser;
  const authUser = (req as any).authUser;
  const isSuperAdmin = isSuperAdminEmail(authUser?.email) || currentUser?.siteRole === "super_admin";

  res.json({
    totalUsers: users.count ?? 0,
    totalListings: listings.count ?? 0,
    activeListings: activeListings.count ?? 0,
    totalGroups: groups.count ?? 0,
    pendingReports: reports.count ?? 0,
    bannedUsers: bannedUsers.count ?? 0,
    isSuperAdmin,  // authoritative server-side check
  });
});

// ── Users management ─────────────────────────────────────────
adminRouter.get("/users", async (req, res) => {
  const { search, role, banned, page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  let query = supabaseAdmin.from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`);
  if (role) query = query.eq("site_role", role);
  if (banned === "true") query = query.eq("banned", true);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Annotate each user with is_owner so client can display correctly
  // regardless of what DB site_role says
  const annotated = (data || []).map((u: any) => ({
    ...u,
    is_owner: isSuperAdminEmail(u.email),
    // If owner email but site_role is still 'user', show effective role
    effective_role: isSuperAdminEmail(u.email) ? "super_admin" : (u.site_role || "user"),
  }));

  res.json({ users: annotated, total: count, page: Number(page), limit });
});

adminRouter.get("/users/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

// Ban / unban user
adminRouter.post("/users/:id/ban", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { reason } = req.body;

  const { data: target } = await supabaseAdmin.from("users").select("site_role, email").eq("id", req.params.id).single();
  if (!target) return res.status(404).json({ error: "User not found" });

  // Cannot ban another admin unless super admin
  if (target.site_role !== "user" && !(req as any).isSuperAdmin) {
    return res.status(403).json({ error: "Cannot ban admin users without super admin" });
  }
  if (isSuperAdminEmail(target.email)) {
    return res.status(403).json({ error: "Cannot ban the super admin" });
  }

  await supabaseAdmin.from("users").update({
    banned: true,
    banned_at: new Date().toISOString(),
    banned_reason: reason || "Violated community guidelines",
  }).eq("id", req.params.id);

  // Log the action
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id,
    action: "ban_user",
    target_type: "user",
    target_id: Number(req.params.id),
    notes: reason,
  });

  res.json({ success: true });
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  const adminUser = (req as any).currentUser;

  await supabaseAdmin.from("users").update({
    banned: false,
    banned_at: null,
    banned_reason: null,
  }).eq("id", req.params.id);

  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id,
    action: "unban_user",
    target_type: "user",
    target_id: Number(req.params.id),
    notes: null,
  });

  res.json({ success: true });
});

// Promote / demote site role (super admin only)
adminRouter.post("/users/:id/role", requireSuperAdmin, async (req, res) => {
  const { role, adminPermissions, permissionTemplate } = req.body;
  const adminUser = (req as any).currentUser;
  const authUser = (req as any).authUser;

  const validRoles = ["user", "site_admin", "super_admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Use: ${validRoles.join(", ")}` });
  }

  // Only the platform owner (hardcoded email) can grant super_admin
  if (role === "super_admin" && !isSuperAdminEmail(authUser.email)) {
    return res.status(403).json({ error: "Only the platform owner can grant super_admin" });
  }

  const { data: target } = await supabaseAdmin
    .from("users").select("email").eq("id", req.params.id).single();
  if (isSuperAdminEmail(target?.email)) {
    return res.status(403).json({ error: "Cannot change the platform owner's role" });
  }

  // Build permission set if provided
  const updates: any = { site_role: role };
  if (role !== "user") {
    if (permissionTemplate) {
      const { ROLE_TEMPLATES } = await import("./permissions");
      const tmpl = ROLE_TEMPLATES[permissionTemplate];
      if (tmpl) {
        const perms: Record<string, boolean> = {};
        for (const p of tmpl.permissions) perms[p] = true;
        updates.admin_permissions = perms;
      }
    } else if (adminPermissions && typeof adminPermissions === "object") {
      updates.admin_permissions = adminPermissions;
    }
  } else {
    updates.admin_permissions = {}; // clear all permissions when demoting
  }

  await supabaseAdmin.from("users").update(updates).eq("id", req.params.id);

  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id,
    action: `set_role_${role}`,
    target_type: "user",
    target_id: Number(req.params.id),
    notes: permissionTemplate ? `template: ${permissionTemplate}` : null,
  });

  res.json({ success: true });
});

// Verify / unverify with audit log
adminRouter.post("/users/:id/verify", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { verified } = req.body;
  await supabaseAdmin.from("users").update({ verified }).eq("id", req.params.id);
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id,
    action: verified ? "verify_user" : "unverify_user",
    target_type: "user",
    target_id: Number(req.params.id),
    notes: null,
  }).catch(() => {});
  res.json({ success: true });
});

// ── Listings management ──────────────────────────────────────
adminRouter.get("/listings", async (req, res) => {
  const { search, status, page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  let query = supabaseAdmin.from("listings")
    .select("*, users!seller_id(username, display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ listings: data, total: count, page: Number(page), limit });
});

// Delete listing
adminRouter.delete("/listings/:id", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { reason } = req.body;

  await supabaseAdmin.from("listings").delete().eq("id", req.params.id);

  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id,
    action: "delete_listing",
    target_type: "listing",
    target_id: Number(req.params.id),
    notes: reason,
  });

  res.json({ success: true });
});

// Feature / unfeature listing
adminRouter.post("/listings/:id/feature", async (req, res) => {
  const { featured } = req.body;
  await supabaseAdmin.from("listings").update({ featured }).eq("id", req.params.id);
  res.json({ success: true });
});

// ── Reports management ───────────────────────────────────────
adminRouter.get("/reports", async (req, res) => {
  const { status = "pending", page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("reports")
    .select("*, reporter:reporter_id(id, username, display_name, avatar)", { count: "exact" })
    .eq("status", status as string)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: data, total: count, page: Number(page), limit });
});

adminRouter.patch("/reports/:id", async (req, res) => {
  const adminUser = (req as any).currentUser;
  const { status, resolution } = req.body;

  await supabaseAdmin.from("reports").update({
    status,
    resolution,
    reviewed_by: adminUser.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", req.params.id);

  res.json({ success: true });
});

// ── Audit log ────────────────────────────────────────────────
adminRouter.get("/audit", requireSuperAdmin, async (req, res) => {
  const { page = "1" } = req.query;
  const limit = 50;
  const offset = (Number(page) - 1) * limit;

  const { data, count } = await supabaseAdmin
    .from("admin_actions")
    .select("*, admin:admin_id(id, username, display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({ actions: data, total: count, page: Number(page), limit });
});

// ── Group management ─────────────────────────────────────────
adminRouter.get("/groups", async (req, res) => {
  const { page = "1" } = req.query;
  const limit = 25;
  const offset = (Number(page) - 1) * limit;

  const { data, count } = await supabaseAdmin
    .from("groups")
    .select("*, owner:owner_id(id, username, display_name)", { count: "exact" })
    .order("member_count", { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({ groups: data, total: count, page: Number(page), limit });
});

adminRouter.delete("/groups/:id", async (req, res) => {
  const adminUser = (req as any).currentUser;
  await supabaseAdmin.from("groups").delete().eq("id", req.params.id);
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id, action: "delete_group",
    target_type: "group", target_id: Number(req.params.id), notes: req.body.reason,
  });
  res.json({ success: true });
});

// GET /api/admin/groups/:id/members
adminRouter.get("/groups/:id/members", async (_req, res) => {
  const { data } = await supabaseAdmin
    .from("group_members")
    .select("user_id, role, joined_at, user:users!group_members_user_id_fkey(id, username, display_name, avatar, verified, site_role)")
    .eq("group_id", Number(_req.params.id))
    .order("role");
  res.json(data || []);
});

// PATCH /api/admin/groups/:id/members/:userId — change role or remove
adminRouter.patch("/groups/:id/members/:userId", async (req, res) => {
  const { role } = req.body;
  if (!["owner", "admin", "moderator", "member"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  await supabaseAdmin.from("group_members")
    .update({ role })
    .eq("group_id", Number(req.params.id))
    .eq("user_id", Number(req.params.userId));
  res.json({ success: true });
});

// DELETE /api/admin/groups/:id/members/:userId — remove from group
adminRouter.delete("/groups/:id/members/:userId", async (req, res) => {
  const adminUser = (req as any).currentUser;
  await supabaseAdmin.from("group_members")
    .delete()
    .eq("group_id", Number(req.params.id))
    .eq("user_id", Number(req.params.userId));
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminUser.id, action: "remove_group_member",
    target_type: "group", target_id: Number(req.params.id),
    notes: `removed user ${req.params.userId}`,
  }).catch(() => {});
  res.json({ success: true });
});

// ── Submit a report (public, auth required) ──────────────────
export const reportRouter = Router();
reportRouter.use(requireAuth);

reportRouter.post("/", async (req, res) => {
  const currentUser = (req as any).currentUser;
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const { targetType, targetId, reason, description } = req.body;
  const { data, error } = await supabaseAdmin.from("reports").insert({
    reporter_id: currentUser.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    description,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});
