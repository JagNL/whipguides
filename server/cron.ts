/**
 * WhipGuides internal cron jobs — runs inside Railway, no external dependency.
 * Called once from server/index.ts on startup.
 */
import cron from "node-cron";
import { supabaseAdmin } from "./supabase";
import { sendEmail, listingExpiryWarningEmail, listingExpiredEmail } from "./email";

// Lazy-import storage to avoid circular deps at startup
async function getStorage() {
  const { storage } = await import("./storage");
  return storage;
}

async function runListingExpiry() {
  console.log("[cron] Running listing expiry check...");
  const storage = await getStorage();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString();
  const in3Days = new Date(now.getTime() + 3 * 86400000).toISOString();
  let expired = 0, warned7 = 0, warned3 = 0;

  try {
    // 1. Expire listings past their expires_at
    const { data: toExpire } = await supabaseAdmin
      .from("listings")
      .select("id, title, price, seller_id")
      .eq("status", "active")
      .lt("expires_at", now.toISOString());

    for (const l of (toExpire || [])) {
      await supabaseAdmin.from("listings").update({ status: "expired" }).eq("id", l.id);
      expired++;
      const seller = await storage.getUser(l.seller_id) as any;
      if (seller?.email) {
        const { subject, html } = listingExpiredEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
        });
        await sendEmail(seller.email, subject, html);
      }
      (storage as any).createNotification({
        userId: l.seller_id,
        type: "listing_expired",
        title: "Listing expired — refresh to relist",
        body: l.title,
        linkType: "listing",
        linkId: l.id,
      }).catch(() => {});
    }

    // 2. 7-day warning
    const { data: warn7 } = await supabaseAdmin
      .from("listings")
      .select("id, title, price, seller_id, expires_at")
      .eq("status", "active")
      .eq("expiry_warned", false)
      .lt("expires_at", in7Days)
      .gt("expires_at", now.toISOString());

    for (const l of (warn7 || [])) {
      const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - now.getTime()) / 86400000);
      await supabaseAdmin.from("listings").update({ expiry_warned: true }).eq("id", l.id);
      warned7++;
      const seller = await storage.getUser(l.seller_id) as any;
      if (seller?.email) {
        const { subject, html } = listingExpiryWarningEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
          daysLeft,
          expiresAt: l.expires_at,
        });
        await sendEmail(seller.email, subject, html);
      }
      (storage as any).createNotification({
        userId: l.seller_id,
        type: "listing_expiry_warning",
        title: `Your listing expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        body: `Refresh "${l.title}" to keep it active`,
        linkType: "listing",
        linkId: l.id,
      }).catch(() => {});
    }

    // 3. 3-day warning
    const { data: warn3 } = await supabaseAdmin
      .from("listings")
      .select("id, title, price, seller_id, expires_at")
      .eq("status", "active")
      .eq("expiry_warned", true)
      .eq("expiry_warned2", false)
      .lt("expires_at", in3Days)
      .gt("expires_at", now.toISOString());

    for (const l of (warn3 || [])) {
      const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - now.getTime()) / 86400000);
      await supabaseAdmin.from("listings").update({ expiry_warned2: true }).eq("id", l.id);
      warned3++;
      const seller = await storage.getUser(l.seller_id) as any;
      if (seller?.email) {
        const { subject, html } = listingExpiryWarningEmail({
          userName: seller.displayName || seller.username || "there",
          listingTitle: l.title,
          listingId: l.id,
          price: l.price,
          daysLeft,
          expiresAt: l.expires_at,
        });
        await sendEmail(seller.email, subject, html);
      }
    }

    console.log(`[cron] Expiry run complete: ${expired} expired, ${warned7} warned (7d), ${warned3} warned (3d)`);
  } catch (err) {
    console.error("[cron] Expiry run error:", err);
  }
}

// ── AI parts extraction batch job ──────────────────────────
async function runPartsExtractionBatch() {
  console.log("[cron] Running AI parts extraction batch...");
  try {
    const { reprocessGuideExtractions } = await import("./parts-extractor");
    // Process newest 10 guides that don't have an approved manifest yet
    const result = await reprocessGuideExtractions({ limit: 10 });
    console.log(`[cron] Parts extraction: ${result.processed} processed, ${result.errors} errors`);
  } catch (err: any) {
    console.error("[cron] Parts extraction batch error:", err.message);
  }
}

export function startCronJobs() {
  // Run once at startup if Supabase is configured (catches any missed runs after redeploy)
  const { isSupabaseConfigured } = require("./supabase");
  if (!isSupabaseConfigured()) {
    console.log("[cron] Supabase not configured — skipping cron setup");
    return;
  }

  // Daily at 11:00 UTC (6:00 AM CDT)
  cron.schedule("0 11 * * *", () => {
    runListingExpiry();
  }, { timezone: "UTC" });

  // AI parts extraction — every 4 hours, picks up new guides
  cron.schedule("0 */4 * * *", () => {
    runPartsExtractionBatch();
  }, { timezone: "UTC" });

  console.log("[cron] Listing expiry job: daily at 11:00 UTC");
  console.log("[cron] AI parts extraction: every 4 hours");
}
