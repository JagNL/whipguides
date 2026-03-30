/**
 * server/affiliate.ts
 *
 * Full affiliate & AI parts intelligence router.
 * All management endpoints require super admin permissions.
 * Public endpoints (click tracking, viewing approved products) are open.
 */
import { Router } from "express";
import { requireAuth } from "./auth";
import { requirePermission, requireAnyPermission } from "./permissions";
import { supabaseAdmin } from "./supabase";
import { getLLMProviderStatus } from "./llm-provider";
import { getAffiliateProviderStatus } from "./affiliate-providers";
import {
  extractGuidePartsManifest,
  matchAffiliateProducts,
  reprocessGuideExtractions,
} from "./parts-extractor";
import { createHash } from "crypto";

export const affiliateRouter = Router();

const sb = supabaseAdmin;

// ─── Helper: hash IP for privacy ─────────────────────────────
function hashIp(ip: string): string {
  const salt = process.env.IP_SALT || "wg-affiliate-2026";
  return createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

// GET /api/affiliate/products/:guideId — approved products for a guide
affiliateRouter.get("/products/:guideId", async (req, res) => {
  if (!sb) return res.json({ products: [] });

  const guideId = Number(req.params.guideId);
  if (isNaN(guideId)) return res.status(400).json({ error: "Invalid guide ID" });

  // Get latest approved manifest for this guide
  const { data: manifest } = await sb
    .from("guide_parts_manifest")
    .select("id, vehicle, parts_needed, upgrade_opportunities, safety_warnings, fluids, auto_approve_score")
    .eq("guide_id", guideId)
    .in("review_status", ["approved", "auto_approved"])
    .order("extracted_at", { ascending: false })
    .limit(1)
    .single();

  if (!manifest) return res.json({ manifest: null, products: [] });

  // Get approved affiliate products for this manifest
  const { data: products } = await sb
    .from("affiliate_products")
    .select("*, vendor:affiliate_vendors(name, logo_url, quality_tier)")
    .eq("manifest_id", manifest.id)
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("quality_tier", { ascending: true }) // premium first
    .limit(20);

  res.json({
    manifest: {
      vehicle: manifest.vehicle,
      partsNeeded: manifest.parts_needed,
      upgradeOpportunities: manifest.upgrade_opportunities,
      safetyWarnings: manifest.safety_warnings,
      fluids: manifest.fluids,
      confidenceScore: manifest.auto_approve_score,
    },
    products: products || [],
  });
});

// POST /api/affiliate/click/:productId — track a click
affiliateRouter.post("/click/:productId", async (req, res) => {
  if (!sb) return res.json({ success: true, url: "" });

  const productId = Number(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID" });

  const { guideId } = req.body;
  const userId = (req as any).currentUser?.id || null;
  const ip = req.ip || req.socket.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";

  // Get the affiliate URL before incrementing
  const { data: product } = await sb
    .from("affiliate_products")
    .select("affiliate_url, click_count")
    .eq("id", productId)
    .eq("is_approved", true)
    .single();

  if (!product) return res.status(404).json({ error: "Product not found" });

  // Track click (fire & forget)
  Promise.all([
    sb.from("affiliate_clicks").insert({
      product_id: productId,
      guide_id: guideId || null,
      user_id: userId,
      ip_hash: hashIp(ip),
      user_agent_hash: createHash("sha256").update(userAgent).digest("hex").slice(0, 16),
      referrer: req.headers.referer || null,
    }),
    sb.from("affiliate_products")
      .update({ click_count: (product.click_count || 0) + 1 })
      .eq("id", productId),
  ]).catch(() => {});

  res.json({ success: true, url: product.affiliate_url });
});

// ============================================================
// SUPER ADMIN — SYSTEM STATUS
// ============================================================

// GET /api/affiliate/admin/status
affiliateRouter.get("/admin/status",
  requireAuth, requirePermission("affiliate.view"),
  async (req, res) => {
    const llm = getLLMProviderStatus();
    const providers = getAffiliateProviderStatus();

    const [
      { count: pendingCount },
      { count: vendorCount },
      { count: productCount },
      { count: clickCount30d },
    ] = await Promise.all([
      sb!.from("guide_parts_manifest").select("*", { count: "exact", head: true }).eq("review_status", "pending"),
      sb!.from("affiliate_vendors").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb!.from("affiliate_products").select("*", { count: "exact", head: true }).eq("is_approved", true),
      sb!.from("affiliate_clicks").select("*", { count: "exact", head: true })
        .gte("clicked_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    res.json({
      llm,
      affiliateProviders: providers,
      stats: {
        pendingReviews: pendingCount ?? 0,
        activeVendors: vendorCount ?? 0,
        approvedProducts: productCount ?? 0,
        clicks30d: clickCount30d ?? 0,
        autoApproveThreshold: Number(process.env.PARTS_AUTO_APPROVE_SCORE || "0.85"),
      },
    });
  }
);

// ============================================================
// SUPER ADMIN — REVIEW QUEUE
// ============================================================

// GET /api/affiliate/admin/queue — pending manifests
affiliateRouter.get("/admin/queue",
  requireAuth, requireAnyPermission("affiliate.approve_parts", "guides.approve_extraction"),
  async (req, res) => {
    const { status = "pending", limit = "20", offset = "0" } = req.query;

    const { data, count } = await sb!
      .from("guide_parts_manifest")
      .select(`
        id, guide_id, extracted_at, extraction_model, review_status,
        auto_approve_score, vehicle, parts_needed, upgrade_opportunities,
        safety_warnings, review_notes,
        guide:guides(id, title, vehicle_make, vehicle_model, vehicle_year_start, author_id)
      `, { count: "exact" })
      .eq("review_status", status as string)
      .order("extracted_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    res.json({ items: data || [], total: count ?? 0 });
  }
);

// GET /api/affiliate/admin/queue/:id — single manifest detail
affiliateRouter.get("/admin/queue/:id",
  requireAuth, requireAnyPermission("affiliate.approve_parts", "guides.approve_extraction"),
  async (req, res) => {
    const { data } = await sb!
      .from("guide_parts_manifest")
      .select(`
        *,
        guide:guides(id, title, description, vehicle_make, vehicle_model,
          vehicle_year_start, vehicle_year_end, category, steps),
        reviewer:users!guide_parts_manifest_reviewed_by_fkey(id, display_name, username)
      `)
      .eq("id", Number(req.params.id))
      .single();

    if (!data) return res.status(404).json({ error: "Not found" });

    // Also get matched products
    const { data: products } = await sb!
      .from("affiliate_products")
      .select("*, vendor:affiliate_vendors(name, logo_url)")
      .eq("manifest_id", Number(req.params.id));

    res.json({ manifest: data, products: products || [] });
  }
);

// PATCH /api/affiliate/admin/queue/:id — approve / reject / edit
affiliateRouter.patch("/admin/queue/:id",
  requireAuth, requireAnyPermission("affiliate.approve_parts", "guides.approve_extraction"),
  async (req, res) => {
    const currentUser = (req as any).currentUser;
    const manifestId = Number(req.params.id);
    const {
      action, // "approve" | "reject" | "edit"
      reviewNotes,
      partsNeeded,
      upgradeOpportunities,
      safetyWarnings,
    } = req.body;

    if (!["approve", "reject", "edit"].includes(action)) {
      return res.status(400).json({ error: "action must be approve|reject|edit" });
    }

    const updates: any = {
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    };

    if (action === "approve") {
      updates.review_status = "approved";
      if (partsNeeded) updates.parts_needed = partsNeeded;
      if (upgradeOpportunities) updates.upgrade_opportunities = upgradeOpportunities;
      if (safetyWarnings) updates.safety_warnings = safetyWarnings;
    } else if (action === "reject") {
      updates.review_status = "rejected";
    } else if (action === "edit") {
      // Edit without changing review status
      if (partsNeeded) updates.parts_needed = partsNeeded;
      if (upgradeOpportunities) updates.upgrade_opportunities = upgradeOpportunities;
    }

    const { data, error } = await sb!
      .from("guide_parts_manifest")
      .update(updates)
      .eq("id", manifestId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // If approved, trigger affiliate product matching
    if (action === "approve") {
      const { storage } = await import("./storage");
      const guide = await storage.getGuide(data.guide_id);
      if (guide) {
        matchAffiliateProducts(manifestId, guide, {
          vehicle: data.vehicle,
          partsRemoved: data.parts_removed || [],
          partsNeeded: data.parts_needed || [],
          upgradeOpportunities: data.upgrade_opportunities || [],
          safetyWarnings: data.safety_warnings || [],
          fluids: data.fluids || [],
          toolsDetected: data.tools_detected || [],
          confidenceScore: data.auto_approve_score || 0,
        }).catch(() => {});
      }
    }

    res.json(data);
  }
);

// POST /api/affiliate/admin/queue/extract/:guideId — manual re-extract
affiliateRouter.post("/admin/queue/extract/:guideId",
  requireAuth, requireAnyPermission("affiliate.approve_parts", "guides.approve_extraction"),
  async (req, res) => {
    const guideId = Number(req.params.guideId);
    const { storage } = await import("./storage");
    const guide = await storage.getGuide(guideId);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    const result = await extractGuidePartsManifest(guide, { force: true });
    res.json(result);
  }
);

// ============================================================
// SUPER ADMIN — VENDORS
// ============================================================

// GET /api/affiliate/admin/vendors
affiliateRouter.get("/admin/vendors",
  requireAuth, requirePermission("affiliate.manage_vendors"),
  async (req, res) => {
    const { data } = await sb!
      .from("affiliate_vendors")
      .select("*")
      .order("name");
    res.json(data || []);
  }
);

// POST /api/affiliate/admin/vendors
affiliateRouter.post("/admin/vendors",
  requireAuth, requirePermission("affiliate.manage_vendors"),
  async (req, res) => {
    const {
      name, slug, providerType, baseUrl, affiliateTag, apiKey, apiSecret,
      commissionRate, verticals, qualityTier, description, logoUrl, notes,
    } = req.body;

    if (!name || !slug || !providerType) {
      return res.status(400).json({ error: "name, slug, providerType required" });
    }

    const { data, error } = await sb!.from("affiliate_vendors").insert({
      name, slug,
      provider_type: providerType,
      base_url: baseUrl || "",
      affiliate_tag: affiliateTag || null,
      api_key: apiKey || null,
      api_secret: apiSecret || null,
      commission_rate: commissionRate || 0.05,
      verticals: verticals || [],
      quality_tier: qualityTier || "standard",
      description: description || null,
      logo_url: logoUrl || null,
      notes: notes || null,
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  }
);

// PATCH /api/affiliate/admin/vendors/:id
affiliateRouter.patch("/admin/vendors/:id",
  requireAuth, requirePermission("affiliate.manage_vendors"),
  async (req, res) => {
    const allowed = [
      "name", "base_url", "affiliate_tag", "api_key", "api_secret",
      "commission_rate", "verticals", "quality_tier", "description",
      "logo_url", "notes", "status",
    ];
    const updates: any = {};
    for (const k of allowed) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[camel] !== undefined) updates[k] = req.body[camel];
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await sb!
      .from("affiliate_vendors")
      .update(updates)
      .eq("id", Number(req.params.id))
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// DELETE /api/affiliate/admin/vendors/:id
affiliateRouter.delete("/admin/vendors/:id",
  requireAuth, requirePermission("affiliate.manage_vendors"),
  async (req, res) => {
    await sb!.from("affiliate_vendors").update({ status: "suspended" }).eq("id", Number(req.params.id));
    res.json({ success: true });
  }
);

// ============================================================
// SUPER ADMIN — PRODUCTS
// ============================================================

// GET /api/affiliate/admin/products
affiliateRouter.get("/admin/products",
  requireAuth, requireAnyPermission("affiliate.manage_products", "affiliate.approve_parts"),
  async (req, res) => {
    const { manifestId, approved, limit = "50" } = req.query;
    let q = sb!.from("affiliate_products")
      .select("*, vendor:affiliate_vendors(name, logo_url)")
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (manifestId) q = q.eq("manifest_id", Number(manifestId));
    if (approved === "true") q = q.eq("is_approved", true);
    if (approved === "false") q = q.eq("is_approved", false);

    const { data } = await q;
    res.json(data || []);
  }
);

// PATCH /api/affiliate/admin/products/:id — approve/edit a product
affiliateRouter.patch("/admin/products/:id",
  requireAuth, requirePermission("affiliate.manage_products"),
  async (req, res) => {
    const currentUser = (req as any).currentUser;
    const allowed = ["title","description","product_url","affiliate_url","image_url","price_cents","brand","part_number","quality_tier","is_featured","placement_type"];
    const updates: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    if (req.body.isApproved !== undefined) {
      updates.is_approved = req.body.isApproved;
      if (req.body.isApproved) {
        updates.approved_by = currentUser.id;
        updates.approved_at = new Date().toISOString();
      }
    }

    const { data, error } = await sb!
      .from("affiliate_products")
      .update(updates)
      .eq("id", Number(req.params.id))
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// DELETE /api/affiliate/admin/products/:id
affiliateRouter.delete("/admin/products/:id",
  requireAuth, requirePermission("affiliate.manage_products"),
  async (req, res) => {
    await sb!.from("affiliate_products").delete().eq("id", Number(req.params.id));
    res.json({ success: true });
  }
);

// ============================================================
// SUPER ADMIN — ANALYTICS
// ============================================================

// GET /api/affiliate/admin/analytics — revenue + click stats
affiliateRouter.get("/admin/analytics",
  requireAuth, requirePermission("affiliate.view_revenue"),
  async (req, res) => {
    const { days = "30" } = req.query;
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString();

    const [
      { data: topProducts },
      { data: topGuides },
      { data: clicksByDay },
      { data: vendorStats },
    ] = await Promise.all([
      sb!.from("affiliate_products")
        .select("id, title, click_count, conversion_count, revenue_cents, vendor:affiliate_vendors(name)")
        .order("click_count", { ascending: false })
        .limit(10),

      sb!.from("affiliate_clicks")
        .select("guide_id, count:id")
        .gte("clicked_at", since)
        .not("guide_id", "is", null)
        .limit(10),

      sb!.from("affiliate_clicks")
        .select("clicked_at")
        .gte("clicked_at", since)
        .order("clicked_at", { ascending: true }),

      sb!.from("affiliate_vendors")
        .select("name, quality_tier")
        .eq("status", "active"),
    ]);

    // Aggregate clicks by day
    const clickMap: Record<string, number> = {};
    for (const c of (clicksByDay || [])) {
      const day = c.clicked_at.slice(0, 10);
      clickMap[day] = (clickMap[day] || 0) + 1;
    }

    res.json({
      topProducts: topProducts || [],
      topGuides: topGuides || [],
      clicksByDay: Object.entries(clickMap).map(([date, clicks]) => ({ date, clicks })),
      activeVendors: vendorStats || [],
    });
  }
);

// ============================================================
// SUPER ADMIN — PERMISSIONS MANAGEMENT
// ============================================================

// GET /api/affiliate/admin/permissions-catalogue — for admin UI
affiliateRouter.get("/admin/permissions-catalogue",
  requireAuth,
  async (req, res) => {
    const { PERMISSIONS, PERMISSION_DOMAINS, ROLE_TEMPLATES } = await import("./permissions");
    res.json({ permissions: PERMISSIONS, domains: PERMISSION_DOMAINS, templates: ROLE_TEMPLATES });
  }
);

// GET /api/affiliate/admin/admins — list all admins with permissions
affiliateRouter.get("/admin/admins",
  requireAuth, requirePermission("users.set_role"),
  async (req, res) => {
    const { data } = await sb!
      .from("users")
      .select("id, username, display_name, email, avatar, site_role, admin_permissions, created_at")
      .in("site_role", ["super_admin", "site_admin"])
      .order("site_role")
      .order("display_name");
    res.json(data || []);
  }
);

// PATCH /api/affiliate/admin/admins/:id/permissions — set permissions for an admin
affiliateRouter.patch("/admin/admins/:id/permissions",
  requireAuth, requirePermission("users.set_role"),
  async (req, res) => {
    const authUser = (req as any).authUser;
    const { isSuperAdminEmail } = await import("./admin");

    // Only the owner can modify other admins' permissions
    if (!isSuperAdminEmail(authUser.email)) {
      return res.status(403).json({ error: "Only the platform owner can modify admin permissions" });
    }

    const { permissions, template } = req.body;
    // permissions: { "users.ban": true, "affiliate.manage_vendors": false, ... }
    // template: "content_moderator" | "ads_manager" | etc.

    let newPerms: Record<string, boolean> = {};

    if (template) {
      const { ROLE_TEMPLATES } = await import("./permissions");
      const tmpl = ROLE_TEMPLATES[template];
      if (!tmpl) return res.status(400).json({ error: "Unknown template" });
      for (const p of tmpl.permissions) newPerms[p] = true;
    } else if (permissions && typeof permissions === "object") {
      newPerms = permissions;
    } else {
      return res.status(400).json({ error: "permissions or template required" });
    }

    const { data, error } = await sb!
      .from("users")
      .update({ admin_permissions: newPerms })
      .eq("id", Number(req.params.id))
      .select("id, username, display_name, site_role, admin_permissions")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// GET /api/affiliate/me/permissions — current user's permission set
affiliateRouter.get("/me/permissions",
  requireAuth,
  async (req, res) => {
    const { getUserPermissions } = await import("./permissions");
    res.json(getUserPermissions(req));
  }
);

// ============================================================
// SUPER ADMIN — LLM CONFIG
// ============================================================

// POST /api/affiliate/admin/reprocess — batch re-extract guides
affiliateRouter.post("/admin/reprocess",
  requireAuth, requirePermission("guides.approve_extraction"),
  async (req, res) => {
    const { guideIds, limit, forceAll } = req.body;
    const result = await reprocessGuideExtractions({ guideIds, limit, forceAll });
    res.json(result);
  }
);

// GET /api/affiliate/admin/llm-status
affiliateRouter.get("/admin/llm-status",
  requireAuth, requirePermission("system.health"),
  async (_req, res) => {
    const { resetLLMProvider } = await import("./llm-provider");
    resetLLMProvider(); // re-detect on next call
    res.json(getLLMProviderStatus());
  }
);
