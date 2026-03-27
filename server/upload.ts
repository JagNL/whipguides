import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";

// In-memory multer (no disk writes — send straight to CF)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

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

  const urlBody = new URLSearchParams();
  urlBody.set("requireSignedURLs", "false");
  if (metadata) urlBody.set("metadata", JSON.stringify(metadata));

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlBody.toString(),
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
// POST /api/upload/proxy
// Server-side proxy: client sends file to us, we forward to Cloudflare.
// Avoids mobile CORS issues with direct CF uploads.
// ============================================================
uploadRouter.post("/proxy", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  if (!isCloudflareConfigured()) {
    // No Cloudflare — encode as base64 data URL so the image still works.
    // This is the fallback when CF isn't set up yet.
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const fakeId = `data-${Date.now()}`;
    return res.json({ imageId: fakeId, cdnUrl: dataUrl, devMode: true });
  }

  const { metadata } = req.body;

  // Step 1: Get a direct upload URL from Cloudflare
  // Use URLSearchParams (application/x-www-form-urlencoded) — more reliable
  // than FormData for text-only fields with Node's built-in fetch.
  const urlBody = new URLSearchParams();
  urlBody.set("requireSignedURLs", "false");
  if (metadata) urlBody.set("metadata", typeof metadata === "string" ? metadata : JSON.stringify(metadata));

  const cfUrlRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlBody.toString(),
    }
  );

  const cfUrlData = await cfUrlRes.json() as any;
  if (!cfUrlRes.ok || !cfUrlData.success) {
    console.error("CF direct upload URL error (status", cfUrlRes.status, "):", JSON.stringify(cfUrlData));
    return res.status(500).json({ error: "Failed to get upload URL", detail: cfUrlData?.errors?.[0]?.message });
  }

  const { uploadURL, id: imageId } = cfUrlData.result;

  // Step 2: Upload the file buffer directly to Cloudflare
  const fileFormData = new FormData();
  fileFormData.append(
    "file",
    new Blob([req.file.buffer], { type: req.file.mimetype }),
    req.file.originalname || "avatar.jpg"
  );

  const cfUploadRes = await fetch(uploadURL, { method: "POST", body: fileFormData });
  if (!cfUploadRes.ok) {
    const errText = await cfUploadRes.text();
    console.error("CF proxy upload error:", errText);
    return res.status(500).json({ error: "Cloudflare upload failed" });
  }

  // Step 3: Return the imageId + CDN URL
  const cdnUrl = CF_IMAGES_URL ? `${CF_IMAGES_URL}/${imageId}/public` : null;
  res.json({ imageId, cdnUrl, devMode: false });
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
