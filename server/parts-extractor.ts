/**
 * server/parts-extractor.ts
 *
 * AI-powered parts extraction pipeline for WhipGuides guides.
 *
 * Pipeline:
 *   1. Build a structured prompt from guide content + annotations
 *   2. Call LLM to extract parts manifest
 *   3. Score confidence → auto-approve high-confidence extractions
 *   4. Store manifest in guide_parts_manifest table
 *   5. Trigger affiliate product matching
 *   6. Notify super admins if review needed
 *
 * Designed to be called:
 *   - On guide create/update (async, non-blocking)
 *   - By cron job for batch re-processing
 *   - Manually from admin panel
 */

import { supabaseAdmin } from "./supabase";
import { getLLMProvider } from "./llm-provider";
import { getAffiliateProvider, VERTICAL_PROVIDERS } from "./affiliate-providers";
import type { Guide, GuideStep } from "./storage";

// ─── Extraction result types ─────────────────────────────────
export interface ExtractedVehicle {
  year?: string;
  make?: string;
  model?: string;
  engine?: string;
  trim?: string;
}

export interface ExtractedPart {
  name: string;
  category: string;  // engine | brakes | suspension | intake | exhaust | electrical | fluid | hardware | other
  oemPart?: string;
  confidence: "high" | "medium" | "low";
  stepRef?: number;  // which step this was found in
}

export interface UpgradeOpportunity {
  name: string;
  category: string;
  benefit: string;
  estimatedHpGain?: string;
  brands: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface SafetyWarning {
  component: string;
  warning: string;
  severity: "critical" | "high" | "medium";
}

export interface PartsManifest {
  vehicle: ExtractedVehicle;
  partsRemoved: ExtractedPart[];
  partsNeeded: ExtractedPart[];
  upgradeOpportunities: UpgradeOpportunity[];
  safetyWarnings: SafetyWarning[];
  fluids: string[];
  toolsDetected: string[];
  confidenceScore: number;  // 0-1 overall extraction confidence
}

// ─── Auto-approve threshold ──────────────────────────────────
const AUTO_APPROVE_THRESHOLD = Number(process.env.PARTS_AUTO_APPROVE_SCORE || "0.85");

// ─── Build extraction prompt ─────────────────────────────────
function buildExtractionPrompt(guide: Guide): { system: string; user: string } {
  const stepsText = (guide.steps || []).map((step: GuideStep, i: number) => {
    const annotations = (step.annotations || []).map((a: any) =>
      `[PIN ${a.type.toUpperCase()}: ${a.label} — ${a.detail}${a.torqueSpec ? ` (${a.torqueSpec})` : ""}${a.socketSize ? ` [${a.socketSize}]` : ""}]`
    ).join(" ");
    return `Step ${i + 1} "${step.title}": ${step.description}${annotations ? `\nAnnotations: ${annotations}` : ""}`;
  }).join("\n\n");

  const toolsList = (guide.tools || []).join(", ");
  const partsList = (guide.parts || []).map((p: any) => p.name).join(", ");

  const system = `You are an expert automotive, powersports, firearms, and mechanical systems parts specialist with deep knowledge of OEM part numbers, aftermarket upgrades, and fitment data.

Your job is to analyse a repair/maintenance guide and extract a structured parts intelligence manifest.

Rules:
1. Only extract parts explicitly mentioned or clearly implied by the guide content and annotations
2. Distinguish between parts that MUST be replaced (wear items, gaskets, seals) vs parts that CAN be upgraded
3. For each upgrade opportunity, be specific about real-world benefits and mention reputable brands
4. Flag safety-critical components with appropriate warnings
5. Confidence scores: "high" = explicitly stated or obvious, "medium" = implied by context, "low" = speculative
6. Return ONLY valid JSON matching the schema below — no markdown, no explanations

JSON Schema:
{
  "vehicle": { "year": string, "make": string, "model": string, "engine": string, "trim": string },
  "parts_removed": [{ "name": string, "category": string, "oem_part": string|null, "confidence": "high"|"medium"|"low", "step_ref": number|null }],
  "parts_needed": [{ "name": string, "category": string, "type": "replacement"|"consumable"|"hardware"|"fluid", "confidence": "high"|"medium"|"low", "reason": string }],
  "upgrade_opportunities": [{ "name": string, "category": string, "benefit": string, "estimated_hp_gain": string|null, "brands": string[], "confidence": "high"|"medium"|"low", "reason": string }],
  "safety_warnings": [{ "component": string, "warning": string, "severity": "critical"|"high"|"medium" }],
  "fluids": [string],
  "tools_detected": [string],
  "confidence_score": number
}`;

  const user = `Guide Title: "${guide.title}"
Vehicle: ${guide.vehicleYearStart}–${guide.vehicleYearEnd} ${guide.vehicleMake} ${guide.vehicleModel}
Category: ${guide.category || "General"}
Difficulty: ${guide.difficulty}
Estimated Time: ${guide.timeEstimate}
Description: ${guide.description}
Tools Listed: ${toolsList || "none"}
Parts Listed: ${partsList || "none"}

Steps:
${stepsText}`;

  return { system, user };
}

// ─── Parse + validate LLM response ──────────────────────────
function parseLLMResponse(raw: string): PartsManifest | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleaned);

    return {
      vehicle: data.vehicle || {},
      partsRemoved: data.parts_removed || [],
      partsNeeded: data.parts_needed || [],
      upgradeOpportunities: data.upgrade_opportunities || [],
      safetyWarnings: data.safety_warnings || [],
      fluids: data.fluids || [],
      toolsDetected: data.tools_detected || [],
      confidenceScore: Math.min(1, Math.max(0, Number(data.confidence_score) || 0)),
    };
  } catch (err) {
    console.error("[extractor] Failed to parse LLM response:", err);
    return null;
  }
}

// ─── Main extraction function ────────────────────────────────
export async function extractGuidePartsManifest(
  guide: Guide,
  options: { force?: boolean; adminUserId?: number } = {}
): Promise<{ manifestId: number | null; status: string }> {
  if (!supabaseAdmin) return { manifestId: null, status: "no_db" };

  // Check for existing pending/approved manifest (skip if not forced)
  if (!options.force) {
    const { data: existing } = await supabaseAdmin
      .from("guide_parts_manifest")
      .select("id, review_status")
      .eq("guide_id", guide.id)
      .order("extraction_version", { ascending: false })
      .limit(1)
      .single();

    if (existing && ["approved", "auto_approved", "pending"].includes(existing.review_status)) {
      return { manifestId: existing.id, status: "already_exists" };
    }
  }

  const llm = getLLMProvider();
  console.log(`[extractor] Extracting parts for guide ${guide.id} using ${llm.name}`);

  const { system, user } = buildExtractionPrompt(guide);
  const llmResponse = await llm.complete({ system, user, json: true, maxTokens: 3000, temperature: 0.1 });

  if (!llmResponse) {
    console.error(`[extractor] LLM call failed for guide ${guide.id}`);
    return { manifestId: null, status: "llm_failed" };
  }

  const manifest = parseLLMResponse(llmResponse.content);
  if (!manifest) {
    return { manifestId: null, status: "parse_failed" };
  }

  // Determine review status based on confidence
  const autoApprove = manifest.confidenceScore >= AUTO_APPROVE_THRESHOLD;
  const reviewStatus = autoApprove ? "auto_approved" : "pending";

  // Get latest version number
  const { data: latestVersion } = await supabaseAdmin
    .from("guide_parts_manifest")
    .select("extraction_version")
    .eq("guide_id", guide.id)
    .order("extraction_version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latestVersion?.extraction_version || 0) + 1;

  // Store manifest
  const { data: stored, error } = await supabaseAdmin
    .from("guide_parts_manifest")
    .insert({
      guide_id: guide.id,
      extraction_model: `${llmResponse.provider}/${llmResponse.model}`,
      extraction_version: nextVersion,
      review_status: reviewStatus,
      auto_approve_score: manifest.confidenceScore,
      vehicle: manifest.vehicle,
      parts_removed: manifest.partsRemoved,
      parts_needed: manifest.partsNeeded,
      upgrade_opportunities: manifest.upgradeOpportunities,
      safety_warnings: manifest.safetyWarnings,
      fluids: manifest.fluids,
      tools_detected: manifest.toolsDetected,
      raw_llm_response: process.env.NODE_ENV === "development" ? llmResponse.content : null,
    })
    .select("id")
    .single();

  if (error || !stored) {
    console.error("[extractor] Failed to store manifest:", error?.message);
    return { manifestId: null, status: "store_failed" };
  }

  console.log(`[extractor] Guide ${guide.id}: manifest ${stored.id} stored (${reviewStatus}, score=${manifest.confidenceScore.toFixed(2)})`);

  // If auto-approved, immediately kick off affiliate matching
  if (autoApprove) {
    matchAffiliateProducts(stored.id, guide, manifest).catch(err =>
      console.error("[extractor] Affiliate matching failed:", err.message)
    );
  }

  // Notify super admins if review needed
  if (!autoApprove) {
    notifySuperAdminsOfReview(guide, stored.id, manifest.confidenceScore).catch(() => {});
  }

  return { manifestId: stored.id, status: reviewStatus };
}

// ─── Affiliate product matching ──────────────────────────────
export async function matchAffiliateProducts(
  manifestId: number,
  guide: Guide,
  manifest: PartsManifest
): Promise<void> {
  if (!supabaseAdmin) return;

  // Get active vendors for this vertical
  const vertical = guideVertical(guide);
  const preferredProviders = VERTICAL_PROVIDERS[vertical] || VERTICAL_PROVIDERS.general;

  const { data: vendors } = await supabaseAdmin
    .from("affiliate_vendors")
    .select("*")
    .eq("status", "active")
    .contains("verticals", [vertical]);

  const activeVendors = vendors || [];

  // Build product candidates from parts_needed + upgrade_opportunities
  const searchItems = [
    ...manifest.partsNeeded.map(p => ({
      term: buildSearchTerm(p.name, manifest.vehicle),
      category: "replacement" as const,
      confidence: p.confidence,
    })),
    ...manifest.upgradeOpportunities.map(u => ({
      term: buildSearchTerm(u.name, manifest.vehicle),
      category: "upgrade" as const,
      confidence: u.confidence,
      brands: u.brands,
    })),
  ].filter(item => item.confidence !== "low"); // skip low-confidence items

  for (const item of searchItems.slice(0, 10)) { // cap at 10 searches per guide
    for (const vendor of activeVendors.slice(0, 3)) { // max 3 vendors per part
      try {
        const provider = getAffiliateProvider(vendor.provider_type);
        const results = await provider.search(
          {
            term: item.term,
            make: manifest.vehicle.make,
            model: manifest.vehicle.model,
            year: manifest.vehicle.year ? Number(manifest.vehicle.year) : undefined,
            engine: manifest.vehicle.engine,
            category: item.category,
          },
          {
            affiliateTag: vendor.affiliate_tag || undefined,
            apiKey: vendor.api_key || undefined,
            apiSecret: vendor.api_secret || undefined,
            baseUrl: vendor.base_url || undefined,
          }
        );

        for (const product of results.slice(0, 2)) {
          await supabaseAdmin.from("affiliate_products").insert({
            vendor_id: vendor.id,
            manifest_id: manifestId,
            part_category: item.category,
            placement_type: item.category === "upgrade" ? "sidebar" : "inline",
            title: product.title,
            description: product.description,
            product_url: product.productUrl,
            affiliate_url: product.affiliateUrl,
            image_url: product.imageUrl,
            price_cents: product.priceCents,
            brand: product.brand,
            part_number: product.partNumber,
            fits_make: product.fitsMake || manifest.vehicle.make,
            fits_year_start: product.fitsYearStart || (manifest.vehicle.year ? Number(manifest.vehicle.year) : null),
            fits_year_end: product.fitsYearEnd || (manifest.vehicle.year ? Number(manifest.vehicle.year) : null),
            fits_engine: product.fitsEngine || manifest.vehicle.engine,
            universal_fit: product.universalFit || false,
            quality_tier: product.qualityTier || vendor.quality_tier,
            is_approved: false, // always needs review
          });
        }
      } catch (err: any) {
        console.error(`[extractor] Affiliate search failed (${vendor.name}/${item.term}):`, err.message);
      }
    }
  }
}

// ─── Notify super admins ─────────────────────────────────────
async function notifySuperAdminsOfReview(
  guide: Guide,
  manifestId: number,
  score: number
): Promise<void> {
  if (!supabaseAdmin) return;

  // Find all users with affiliate.approve_parts permission or super_admin role
  const { data: admins } = await supabaseAdmin
    .from("users")
    .select("id, email, site_role, admin_permissions")
    .or("site_role.eq.super_admin");

  const eligible = (admins || []).filter((u: any) => {
    if (u.site_role === "super_admin") return true;
    const perms = u.admin_permissions || {};
    return perms["affiliate.approve_parts"] === true || perms["guides.approve_extraction"] === true;
  });

  const notifications = eligible.map((u: any) => ({
    user_id: u.id,
    type: "parts_review_needed",
    title: `AI extraction needs review: "${guide.title}"`,
    body: `Confidence: ${(score * 100).toFixed(0)}% — ${guide.vehicleYearStart} ${guide.vehicleMake} ${guide.vehicleModel}`,
    link_type: "admin_affiliate",
    link_id: manifestId,
  }));

  if (notifications.length > 0) {
    await supabaseAdmin.from("notifications").insert(notifications).catch(() => {});
  }
}

// ─── Batch re-processor (called by cron) ────────────────────
export async function reprocessGuideExtractions(options: {
  limit?: number;
  guideIds?: number[];
  forceAll?: boolean;
} = {}): Promise<{ processed: number; errors: number }> {
  if (!supabaseAdmin) return { processed: 0, errors: 0 };

  let query = supabaseAdmin
    .from("guides")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(options.limit || 20);

  if (options.guideIds?.length) {
    query = query.in("id", options.guideIds);
  }

  const { data: guides } = await query;
  if (!guides?.length) return { processed: 0, errors: 0 };

  let processed = 0, errors = 0;

  for (const g of guides) {
    try {
      const { storage } = await import("./storage");
      const guide = await storage.getGuide(g.id);
      if (!guide) continue;
      const result = await extractGuidePartsManifest(guide, { force: options.forceAll });
      if (result.status !== "already_exists" && result.manifestId) processed++;
    } catch (err: any) {
      console.error(`[extractor] Reprocess failed for guide ${g.id}:`, err.message);
      errors++;
    }
  }

  return { processed, errors };
}

// ─── Helpers ─────────────────────────────────────────────────
function buildSearchTerm(partName: string, vehicle: ExtractedVehicle): string {
  const year = vehicle.year || "";
  const make = vehicle.make || "";
  const model = vehicle.model || "";
  if (make && model && year) return `${partName} ${year} ${make} ${model}`.trim();
  return partName;
}

function guideVertical(guide: Guide): string {
  const category = (guide.category || "").toLowerCase();
  const make = (guide.vehicleMake || "").toLowerCase();

  if (["atv", "utv", "jet ski", "boat", "snowmobile", "motorcycle"].some(k => category.includes(k) || make.includes(k))) return "powersports";
  if (category.includes("firearm") || category.includes("gun") || category.includes("rifle")) return "firearms";
  if (category.includes("guitar") || category.includes("music") || category.includes("audio")) return "music";
  if (category.includes("3d") || category.includes("print") || category.includes("maker")) return "maker";
  return "automotive"; // default
}
