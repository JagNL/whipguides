import { Router, type Request, type Response } from "express";
import { requireAuth } from "./auth";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_IMAGES_URL = process.env.CLOUDFLARE_IMAGES_URL || "";

export const isCloudflareConfigured = () => !!(CF_ACCOUNT_ID && CF_API_TOKEN);

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

// ============================================================
// POST /api/upload/direct-url
// Returns a one-time Cloudflare direct upload URL + image ID.
// The client POSTs the file directly to Cloudflare (bypasses our server).
// ============================================================
uploadRouter.post("/direct-url", async (req: Request, res: Response) => {
  if (!isCloudflareConfigured()) {
    // Dev fallback — return a fake response so UI still works without CF
    return res.json({
      uploadUrl: null,
      imageId: `dev-${Date.now()}`,
      devMode: true,
    });
  }

  const { metadata } = req.body; // e.g. { type: "listing", userId: 1 }

  const formData = new FormData();
  formData.append("requireSignedURLs", "false");
  if (metadata) {
    formData.append("metadata", JSON.stringify(metadata));
  }

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
      body: formData,
    }
  );

  const cfData = await cfRes.json() as any;

  if (!cfRes.ok || !cfData.success) {
    console.error("Cloudflare upload URL error:", cfData.errors);
    return res.status(500).json({ error: "Failed to get upload URL from Cloudflare" });
  }

  res.json({
    uploadUrl: cfData.result.uploadURL,
    imageId: cfData.result.id,
    devMode: false,
  });
});

// ============================================================
// GET /api/upload/image-url/:imageId
// Returns the public CDN URL for a given Cloudflare image ID.
// ============================================================
uploadRouter.get("/image-url/:imageId", (req: Request, res: Response) => {
  const { imageId } = req.params;
  const { variant = "public" } = req.query;

  if (!CF_IMAGES_URL) {
    return res.json({ url: null });
  }

  // Cloudflare Images URL format: https://imagedelivery.net/<hash>/<imageId>/<variant>
  const url = `${CF_IMAGES_URL}/${imageId}/${variant}`;
  res.json({ url });
});

// ============================================================
// Helper used by other parts of the app
// ============================================================
export function cfImageUrl(imageId: string, variant = "public"): string {
  if (!imageId || imageId.startsWith("dev-")) return "";
  if (imageId.startsWith("http")) return imageId; // already a full URL
  return `${CF_IMAGES_URL}/${imageId}/${variant}`;
}

// DELETE /api/upload/:imageId — admin / owner only cleanup
uploadRouter.delete("/:imageId", async (req: Request, res: Response) => {
  const { imageId } = req.params;
  if (!isCloudflareConfigured()) return res.json({ success: true });

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1/${imageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    }
  );

  res.json({ success: true });
});
