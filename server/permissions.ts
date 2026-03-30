/**
 * server/permissions.ts
 *
 * Granular permission system for WhipGuides super admins.
 * The platform owner (SUPER_ADMIN_EMAILS) retains all permissions always.
 * Other admins receive a permissions JSONB object stored on their user row.
 *
 * Permission format: "domain.action"  e.g. "users.ban", "affiliate.manage_vendors"
 *
 * Usage:
 *   router.post("/...", requireAuth, requirePermission("affiliate.manage_vendors"), handler)
 */
import type { Request, Response, NextFunction } from "express";
import { isSuperAdminEmail } from "./admin";

// ─── Permission Catalogue ─────────────────────────────────────
export const PERMISSIONS = {
  // User management
  "users.view":          "View user list and profiles",
  "users.ban":           "Ban / unban users",
  "users.set_role":      "Promote / demote admin roles",
  "users.verify":        "Grant verified badges",
  // Content
  "content.delete_posts":     "Delete any post or comment",
  "content.delete_listings":  "Delete any marketplace listing",
  "content.pin_posts":        "Pin posts in any group",
  "content.feature_listings": "Feature listings on homepage",
  // Groups
  "groups.delete":            "Delete any group",
  "groups.manage_admins":     "Manage group admins",
  // Moderation
  "moderation.view_reports":  "View content reports",
  "moderation.resolve":       "Resolve / dismiss reports",
  "moderation.keywords":      "Manage keyword filter list",
  // Advertising
  "advertising.view":         "View ad campaigns and analytics",
  "advertising.manage":       "Create / edit / pause ad campaigns",
  "advertising.vendors":      "Manage ad vendors and accounts",
  // Affiliate & AI Parts
  "affiliate.view":           "View affiliate dashboard and analytics",
  "affiliate.manage_vendors": "Add / edit / remove affiliate vendors",
  "affiliate.approve_parts":  "Approve or reject AI-extracted parts",
  "affiliate.manage_products":"Add / edit / remove affiliate products",
  "affiliate.view_revenue":   "View affiliate revenue data",
  // Guides
  "guides.manage":            "Edit or delete any guide",
  "guides.approve_extraction":"Review AI extraction queue for guides",
  // Finance
  "finance.view_revenue":     "View platform revenue reports",
  "finance.export":           "Export revenue data as CSV",
  // System
  "system.settings":          "Manage platform settings and kill switches",
  "system.health":            "View system health and logs",
  "audit.view":               "View admin audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Role Templates ───────────────────────────────────────────
export const ROLE_TEMPLATES: Record<string, { label: string; description: string; permissions: Permission[] }> = {
  owner: {
    label: "Owner",
    description: "Full access to everything. Cannot be changed.",
    permissions: Object.keys(PERMISSIONS) as Permission[],
  },
  super_admin: {
    label: "Super Admin",
    description: "Full access except finance export and system settings.",
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter(
      p => p !== "finance.export" && p !== "system.settings"
    ),
  },
  content_moderator: {
    label: "Content Moderator",
    description: "Moderate content, resolve reports, ban users.",
    permissions: [
      "users.view", "users.ban",
      "content.delete_posts", "content.delete_listings", "content.pin_posts",
      "moderation.view_reports", "moderation.resolve", "moderation.keywords",
      "groups.manage_admins",
    ],
  },
  ads_manager: {
    label: "Ads Manager",
    description: "Full access to ad campaigns and affiliate system.",
    permissions: [
      "advertising.view", "advertising.manage", "advertising.vendors",
      "affiliate.view", "affiliate.manage_vendors", "affiliate.approve_parts",
      "affiliate.manage_products", "affiliate.view_revenue",
    ],
  },
  community_manager: {
    label: "Community Manager",
    description: "Manage groups, moderate content, handle reports.",
    permissions: [
      "users.view", "users.ban", "users.verify",
      "content.delete_posts", "content.pin_posts",
      "groups.delete", "groups.manage_admins",
      "moderation.view_reports", "moderation.resolve",
    ],
  },
  guide_curator: {
    label: "Guide Curator",
    description: "Manage guides and review AI-extracted parts.",
    permissions: [
      "guides.manage", "guides.approve_extraction",
      "affiliate.view", "affiliate.approve_parts",
    ],
  },
  site_admin: {
    label: "Site Admin",
    description: "Basic moderation and content management.",
    permissions: [
      "users.view", "users.ban",
      "content.delete_posts", "content.delete_listings",
      "moderation.view_reports", "moderation.resolve",
    ],
  },
};

// ─── Permission domains (for UI grouping) ────────────────────
export const PERMISSION_DOMAINS = [
  { key: "users",        label: "Users",        icon: "Users" },
  { key: "content",      label: "Content",      icon: "FileText" },
  { key: "groups",       label: "Groups",       icon: "Users2" },
  { key: "moderation",   label: "Moderation",   icon: "Shield" },
  { key: "advertising",  label: "Advertising",  icon: "Megaphone" },
  { key: "affiliate",    label: "Affiliate & AI", icon: "Link" },
  { key: "guides",       label: "Guides",       icon: "BookOpen" },
  { key: "finance",      label: "Finance",      icon: "DollarSign" },
  { key: "system",       label: "System",       icon: "Settings" },
  { key: "audit",        label: "Audit",        icon: "Activity" },
];

// ─── Permission checker ───────────────────────────────────────

/**
 * Check if a user (from req.currentUser) has a specific permission.
 * Owner email always returns true for everything.
 */
export function hasPermission(req: Request, permission: Permission): boolean {
  const authUser = (req as any).authUser;
  const currentUser = (req as any).currentUser;
  if (!authUser || !currentUser) return false;

  // Owner = always all permissions
  if (isSuperAdminEmail(authUser.email)) return true;

  // site_role super_admin has all permissions unless explicitly restricted
  if (currentUser.siteRole === "super_admin") {
    // Super admins can be restricted by explicit deny in admin_permissions
    const perms = (currentUser as any).adminPermissions || {};
    if (perms[permission] === false) return false; // explicit deny
    return true;
  }

  // site_role site_admin — check admin_permissions JSONB
  if (currentUser.siteRole === "site_admin") {
    const perms = (currentUser as any).adminPermissions || {};
    return perms[permission] === true;
  }

  return false;
}

/**
 * Express middleware: require a specific permission or 403.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission(req, permission)) {
      return res.status(403).json({
        error: `Forbidden — requires permission: ${permission}`,
      });
    }
    next();
  };
}

/**
 * Express middleware: require ANY of the listed permissions.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ok = permissions.some(p => hasPermission(req, p));
    if (!ok) {
      return res.status(403).json({
        error: `Forbidden — requires one of: ${permissions.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Get the full permission set for a user (for serializing to client).
 */
export function getUserPermissions(req: Request): Record<Permission, boolean> {
  const result = {} as Record<Permission, boolean>;
  for (const p of Object.keys(PERMISSIONS) as Permission[]) {
    result[p] = hasPermission(req, p);
  }
  return result;
}
