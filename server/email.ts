/**
 * WhipGuides Email Service — powered by Resend
 * All transactional emails go through here.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "WhipGuides <noreply@whipguides.com>";
const APP_URL = process.env.APP_URL || "https://whipguides-production.up.railway.app";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[Email] No RESEND_API_KEY — skipping email to ${to}: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Send failed:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error:", err);
    return false;
  }
}

// ─── Email templates ──────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #1a1d27; border-radius: 16px; overflow: hidden; border: 1px solid #2d3048; }
    .header { background: linear-gradient(135deg, #1a1d27 0%, #0f1117 100%); padding: 32px 32px 20px; border-bottom: 1px solid #2d3048; }
    .logo { font-size: 22px; font-weight: 800; color: #f97316; letter-spacing: -0.5px; }
    .body { padding: 28px 32px; }
    .footer { padding: 20px 32px; border-top: 1px solid #2d3048; font-size: 12px; color: #64748b; }
    h2 { margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #f1f5f9; }
    p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #94a3b8; }
    .btn { display: inline-block; background: #f97316; color: #fff; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 10px; text-decoration: none; margin: 4px 0 20px; }
    .btn-secondary { display: inline-block; background: #1e2333; border: 1px solid #2d3048; color: #e2e8f0; font-weight: 600; font-size: 14px; padding: 10px 22px; border-radius: 10px; text-decoration: none; margin: 0 8px 20px 0; }
    .listing-card { background: #0f1117; border: 1px solid #2d3048; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .listing-title { font-weight: 700; font-size: 17px; color: #f1f5f9; margin: 0 0 4px; }
    .listing-meta { font-size: 13px; color: #64748b; margin: 0; }
    .price { font-size: 20px; font-weight: 800; color: #f97316; }
    .warning { background: #7c2d12; border: 1px solid #c2410c; border-radius: 10px; padding: 14px 16px; margin: 16px 0; }
    .warning p { color: #fed7aa; margin: 0; }
    .tag { display: inline-block; background: #1e2333; border-radius: 6px; padding: 3px 10px; font-size: 12px; color: #94a3b8; margin-right: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚙ WhipGuides</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>WhipGuides · The community marketplace for enthusiasts<br/>
      You're receiving this because you have an active listing. 
      <a href="${APP_URL}" style="color:#f97316">Manage listings →</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function listingExpiryWarningEmail(opts: {
  userName: string;
  listingTitle: string;
  listingId: number;
  price: number;
  daysLeft: number;
  expiresAt: string;
}): { subject: string; html: string } {
  const subject = `Your listing expires in ${opts.daysLeft} days — refresh to keep it active`;
  const html = baseTemplate(`
    <h2>Your listing is expiring soon</h2>
    <p>Hey ${opts.userName}, your listing will be hidden from search in <strong style="color:#f97316">${opts.daysLeft} days</strong> unless you refresh it.</p>
    
    <div class="listing-card">
      <p class="listing-title">${opts.listingTitle}</p>
      <p class="listing-meta">Listed at <span class="price">$${opts.price.toLocaleString()}</span></p>
    </div>

    <div class="warning">
      <p>⏰ Expires ${new Date(opts.expiresAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
    </div>

    <p>Refreshing your listing moves it back to the top of search results and resets the 30-day clock. It takes one click.</p>

    <a href="${APP_URL}/#/listing/${opts.listingId}" class="btn">Refresh Listing →</a>
    <a href="${APP_URL}/#/profile" class="btn-secondary">View All My Listings</a>

    <p style="font-size:13px;color:#475569">If your item has sold, you can mark it as sold instead to help other sellers gauge market demand.</p>
  `);
  return { subject, html };
}

export function listingExpiredEmail(opts: {
  userName: string;
  listingTitle: string;
  listingId: number;
  price: number;
}): { subject: string; html: string } {
  const subject = `Your listing "${opts.listingTitle}" has expired`;
  const html = baseTemplate(`
    <h2>Your listing has expired</h2>
    <p>Hey ${opts.userName}, your listing is no longer showing in search results. Relist it to get it in front of buyers again.</p>
    
    <div class="listing-card">
      <p class="listing-title">${opts.listingTitle}</p>
      <p class="listing-meta">Last price: <span class="price">$${opts.price.toLocaleString()}</span></p>
    </div>

    <p>You have two options:</p>
    <a href="${APP_URL}/#/listing/${opts.listingId}" class="btn">Refresh & Relist →</a>
    <a href="${APP_URL}/#/listing/${opts.listingId}" class="btn-secondary">Mark as Sold</a>

    <p style="font-size:13px;color:#475569">Refreshing relists your item for another 30 days (60 days for vehicles) and bumps it to the top of search results.</p>
  `);
  return { subject, html };
}

export function listingSoldConfirmEmail(opts: {
  userName: string;
  listingTitle: string;
  price: number;
}): { subject: string; html: string } {
  const subject = `Congrats on your sale! 🎉`;
  const html = baseTemplate(`
    <h2>Item marked as sold 🎉</h2>
    <p>Hey ${opts.userName}, congratulations! Your listing has been marked as sold.</p>
    
    <div class="listing-card">
      <p class="listing-title">${opts.listingTitle}</p>
      <p class="listing-meta">Sold for <span class="price">$${opts.price.toLocaleString()}</span></p>
    </div>

    <p>Have more to sell? List your next item and reach thousands of enthusiasts.</p>
    <a href="${APP_URL}/#/sell" class="btn">List Another Item →</a>
  `);
  return { subject, html };
}
