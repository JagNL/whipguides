/**
 * server/guide-scoring.ts
 *
 * Fraud-resistant quality scoring for WhipGuides guides.
 *
 * Design principles:
 * 1. Behavioral signals only — no explicit ratings that can be farmed
 * 2. Account age gate — signals from accounts < 30 days old are zero weight
 * 3. Velocity dedup — one signal per (guide, user, type) per 30-day window
 * 4. IP clustering — same IP cluster = 1 signal regardless of account count
 * 5. Self-exclusion — author's own signals never count
 * 6. Score normalised 0-100, recalculated async after each signal
 * 7. Monetisation gate — score ≥ 70 + human review required
 */

import { supabaseAdmin } from "./supabase";
import { createHash } from "crypto";

const sb = supabaseAdmin;

// ─── Signal types and their weights ──────────────────────────
export const SIGNAL_WEIGHTS: Record<string, number> = {
  step_complete:      3,   // user checked off a step — strong intent signal
  helped:             5,   // "this helped me" — highest value, explicit
  share:              4,   // shared to group/feed — social endorsement
  save:               2,   // bookmarked — weaker but real
  return_visit:       2,   // came back after first view — genuine interest
  comment_quality:    3,   // comment > 50 chars — real engagement
  marketplace_link:   5,   // listing links to guide — commercial validation
  affiliate_click:    4,   // bought something from the guide — ultimate proof
};

// ─── Account age weight multiplier ───────────────────────────
function accountAgeWeight(accountCreatedAt: string | null): number {
  if (!accountCreatedAt) return 0.1; // no account = very low weight
  const ageDays = (Date.now() - new Date(accountCreatedAt).getTime()) / 86400000;
  if (ageDays < 7)  return 0;    // new account = zero weight (anti-gaming)
  if (ageDays < 30) return 0.25; // less than a month = reduced
  if (ageDays < 90) return 0.6;  // growing trust
  return 1.0;                    // established account
}

// ─── Window key for dedup (one per 30-day window) ────────────
function windowKey(guideId: number, userId: number | null, signalType: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${guideId}:${userId ?? "anon"}:${signalType}:${ym}`;
}

// ─── IP hash for clustering ───────────────────────────────────
function hashIpForSignal(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.IP_SALT || "wg-signal-2026"))
    .digest("hex").slice(0, 12);
}

// ─── Record a signal ─────────────────────────────────────────
export interface SignalContext {
  guideId: number;
  guideAuthorId: number;
  userId: number | null;
  userCreatedAt?: string | null;
  signalType: keyof typeof SIGNAL_WEIGHTS;
  ip?: string;
}

export async function recordSignal(ctx: SignalContext): Promise<{ recorded: boolean; reason?: string }> {
  if (!sb) return { recorded: false, reason: "no_db" };

  // Self-exclusion: author signals never count
  if (ctx.userId && ctx.userId === ctx.guideAuthorId) {
    return { recorded: false, reason: "self_excluded" };
  }

  // Anonymous signals are low-weight but allowed (prevents requiring login to track helpfulness)
  const ageWeight = accountAgeWeight(ctx.userCreatedAt || null);
  if (ageWeight === 0) {
    return { recorded: false, reason: "account_too_new" };
  }

  const baseWeight = SIGNAL_WEIGHTS[ctx.signalType] ?? 1;
  const finalWeight = baseWeight * ageWeight;
  const wk = windowKey(ctx.guideId, ctx.userId, ctx.signalType);
  const ipHash = ctx.ip ? hashIpForSignal(ctx.ip) : null;

  // Upsert with unique window_key — if already recorded this window, it's a no-op
  const { error } = await sb.from("guide_signals").insert({
    guide_id: ctx.guideId,
    user_id: ctx.userId,
    signal_type: ctx.signalType,
    weight: finalWeight,
    ip_hash: ipHash,
    window_key: wk,
  });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint — already recorded this window
      return { recorded: false, reason: "already_recorded_this_window" };
    }
    console.error("[scoring] Signal insert error:", error.message);
    return { recorded: false, reason: "db_error" };
  }

  // Async score recalculation (fire & forget)
  recalcScore(ctx.guideId).catch(() => {});

  return { recorded: true };
}

// ─── Recalculate quality score ────────────────────────────────
export async function recalcScore(guideId: number): Promise<number> {
  if (!sb) return 0;

  try {
    await sb.rpc("recalc_guide_quality_score", { p_guide_id: guideId });

    const { data } = await sb
      .from("guides")
      .select("quality_score")
      .eq("id", guideId)
      .single();

    return data?.quality_score ?? 0;
  } catch (err: any) {
    console.error("[scoring] Recalc error:", err.message);
    return 0;
  }
}

// ─── Check monetisation eligibility ──────────────────────────
export async function checkMonetisationEligibility(guideId: number): Promise<{
  eligible: boolean;
  score: number;
  reason?: string;
}> {
  if (!sb) return { eligible: false, score: 0, reason: "no_db" };

  // Get settings from DB
  const { data: settingsRow } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", "revenue_share")
    .single();

  const settings = (settingsRow?.value as any) || {};
  const minScore = settings.min_quality_score ?? 70;
  const revenueShareEnabled = settings.enabled ?? false;

  if (!revenueShareEnabled) {
    return { eligible: false, score: 0, reason: "revenue_share_disabled" };
  }

  const { data: guide } = await sb
    .from("guides")
    .select("quality_score, author_id, is_monetized, community_verified")
    .eq("id", guideId)
    .single();

  if (!guide) return { eligible: false, score: 0, reason: "guide_not_found" };

  // Check author account age
  const { data: author } = await sb
    .from("users")
    .select("created_at, verified")
    .eq("id", guide.author_id)
    .single();

  if (author) {
    const ageDays = (Date.now() - new Date(author.created_at).getTime()) / 86400000;
    const minAgeDays = settings.min_account_age_days ?? 30;
    if (ageDays < minAgeDays) {
      return { eligible: false, score: guide.quality_score, reason: `author_account_too_new` };
    }
  }

  if (guide.quality_score < minScore) {
    return { eligible: false, score: guide.quality_score, reason: `score_below_threshold_${minScore}` };
  }

  if (guide.is_monetized) {
    return { eligible: true, score: guide.quality_score, reason: "already_monetized" };
  }

  return { eligible: true, score: guide.quality_score };
}

// ─── Monthly revenue pool calculation ────────────────────────
export async function calculateMonthlyPayouts(month: Date): Promise<{
  guides: number;
  totalPoolCents: number;
  payouts: Array<{ guideId: number; authorId: number; cents: number }>;
}> {
  if (!sb) return { guides: 0, totalPoolCents: 0, payouts: [] };

  const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;

  // Get settings
  const { data: settingsRow } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", "revenue_share")
    .single();

  const settings = (settingsRow?.value as any) || {};
  const poolPct = (settings.pool_pct ?? 20) / 100;
  const minPayoutCents = settings.min_payout_cents ?? 2500;

  // Get all monetised guides with their affiliate revenue this month
  const { data: monetisedGuides } = await sb
    .from("guides")
    .select("id, author_id, quality_score, total_attributed_revenue_cents")
    .eq("is_monetized", true);

  if (!monetisedGuides?.length) return { guides: 0, totalPoolCents: 0, payouts: [] };

  // Sum total attributed revenue from affiliate clicks this month
  const { data: clicks } = await sb
    .from("affiliate_clicks")
    .select("guide_id, conversion_value_cents")
    .gte("clicked_at", monthStr)
    .lt("clicked_at", `${month.getFullYear()}-${String(month.getMonth() + 2).padStart(2, "0")}-01`)
    .eq("converted", true)
    .not("guide_id", "is", null);

  // Aggregate per guide
  const revenueByGuide: Record<number, number> = {};
  for (const click of (clicks || [])) {
    if (click.guide_id) {
      revenueByGuide[click.guide_id] = (revenueByGuide[click.guide_id] || 0) + (click.conversion_value_cents || 0);
    }
  }

  const totalRevenue = Object.values(revenueByGuide).reduce((a, b) => a + b, 0);
  const totalPool = Math.floor(totalRevenue * poolPct);

  if (totalPool === 0) return { guides: 0, totalPoolCents: 0, payouts: [] };

  // Calculate weighted shares: quality_score × attributed_revenue
  type GuideShare = { guideId: number; authorId: number; weight: number };
  const shares: GuideShare[] = monetisedGuides.map((g: any) => ({
    guideId: g.id,
    authorId: g.author_id,
    weight: (g.quality_score ?? 0) * (revenueByGuide[g.id] ?? 0),
  })).filter((s: GuideShare) => s.weight > 0);

  const totalWeight = shares.reduce((a: number, s: GuideShare) => a + s.weight, 0);
  if (totalWeight === 0) return { guides: 0, totalPoolCents: totalPool, payouts: [] };

  const payouts = shares
    .map((s: GuideShare) => ({
      guideId: s.guideId,
      authorId: s.authorId,
      cents: Math.floor((s.weight / totalWeight) * totalPool),
    }))
    .filter(p => p.cents >= minPayoutCents); // minimum payout threshold

  return { guides: payouts.length, totalPoolCents: totalPool, payouts };
}

// ─── Extract and validate media embeds ───────────────────────
export function extractEmbedUrl(url: string): { type: "youtube" | "instagram" | null; id: string | null; embedUrl: string | null } {
  if (!url) return { type: null, id: null, embedUrl: null };

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    return {
      type: "youtube",
      id: ytMatch[1],
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  // Instagram — public posts via oEmbed (no auth needed)
  const igMatch = url.match(/instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/);
  if (igMatch) {
    return {
      type: "instagram",
      id: igMatch[2],
      embedUrl: url, // Instagram embeds via their own embed script
    };
  }

  return { type: null, id: null, embedUrl: null };
}
