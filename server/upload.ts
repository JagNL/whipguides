/**
 * WhipGuides — Upload Server (R2 via native fetch + AWS SigV4)
 * No external AWS SDK — uses Node.js built-in crypto for signing.
 *
 * Env vars:
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_ENDPOINT        — https://<account-id>.r2.cloudflarestorage.com
 *   R2_BUCKET          — whipguides-r2
 *   CLOUDFLARE_IMAGES_URL — https://pub-xxx.r2.dev
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";
import { createHmac, createHash } from "crypto";
import { randomUUID } from "crypto";

// ── Config ─────────────────────────────────────────────────────
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_ENDPOINT    = (process.env.R2_ENDPOINT || "").replace(/\/$/, "");
const R2_BUCKET      = process.env.R2_BUCKET || "whipguides-r2";
const PUBLIC_URL     = (process.env.CLOUDFLARE_IMAGES_URL || "").replace(/\/$/, "");

export const isR2Configured = () => !!(R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY);
export const isCloudflareConfigured = isR2Configured; // legacy compat

// ── Multer ─────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── AWS SigV4 signer (pure Node crypto) ───────────────────────
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
function sha256hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function putToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
  const host = new URL(R2_ENDPOINT).host;
  const now  = new Date();
  const dateStamp  = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate    = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const region     = "auto";
  const service    = "s3";

  const payloadHash = sha256hex(body);

  // Canonical request
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalUri = `/${R2_BUCKET}/${key}`;
  const canonicalRequest = [
    "PUT", canonicalUri, "",
    canonicalHeaders, signedHeaders, payloadHash,
  ].join("\n");

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  // Signing key
  const kDate    = hmac("AWS4" + R2_SECRET_KEY, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${url}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Host": host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Authorization": authorization,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function deleteFromR2(key: string): Promise<void> {
  const host = new URL(R2_ENDPOINT).host;
  const now  = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const region = "auto"; const service = "s3";

  const payloadHash = sha256hex("");
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalUri  = `/${R2_BUCKET}/${key}`;
  const canonicalRequest = [
    "DELETE", canonicalUri, "",
    canonicalHeaders, signedHeaders, payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const kDate    = hmac("AWS4" + R2_SECRET_KEY, dateStamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  await fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
    method: "DELETE",
    headers: {
      "Host": host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Authorization": authorization,
    },
  });
}

// ── Router ─────────────────────────────────────────────────────
export const uploadRouter = Router();
uploadRouter.use(requireAuth);

// POST /api/upload/proxy
uploadRouter.post("/proxy", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  // Determine folder from metadata
  let folder = "uploads";
  try {
    const meta = req.body.metadata
      ? (typeof req.body.metadata === "string" ? JSON.parse(req.body.metadata) : req.body.metadata)
      : {};
    if (meta.type === "avatar")   folder = "avatars";
    else if (meta.type === "listing") folder = "listings";
    else if (meta.type === "cover")   folder = "covers";
    else if (meta.type === "guide")   folder = "guides";
    else if (meta.type === "business") folder = "business";
  } catch {}

  if (!isR2Configured()) {
    // Dev fallback — base64 data URL
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    return res.json({ imageId: `data-${Date.now()}`, cdnUrl: dataUrl, devMode: true });
  }

  try {
    const ext = req.file.mimetype.split("/")[1] || "jpg";
    const key = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    await putToR2(key, req.file.buffer, req.file.mimetype);

    const cdnUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;
    res.json({ imageId: key, cdnUrl, devMode: false });
  } catch (err: any) {
    console.error("R2 upload error:", err.message);
    res.status(500).json({ error: "Upload failed", detail: err.message });
  }
});

// POST /api/upload/direct-url (presigned — simplified for now)
uploadRouter.post("/direct-url", async (req: Request, res: Response) => {
  if (!isR2Configured()) {
    return res.json({ uploadUrl: null, imageId: `dev-${Date.now()}`, devMode: true });
  }
  // For simplicity, return null uploadUrl — clients should use /proxy instead
  res.json({ uploadUrl: null, imageId: null, devMode: false, useProxy: true });
});

// GET /api/upload/image-url/:imageId
uploadRouter.get("/image-url/*imageId", (req: Request, res: Response) => {
  const { imageId } = req.params;
  if (!imageId) return res.json({ url: null });
  if (imageId.startsWith("data:") || imageId.startsWith("http")) return res.json({ url: imageId });
  const url = PUBLIC_URL ? `${PUBLIC_URL}/${imageId}` : null;
  res.json({ url });
});

// DELETE /api/upload/:key
uploadRouter.delete("/*key", async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!isR2Configured() || !key) return res.json({ success: true });
  try {
    await deleteFromR2(key);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper exported for other server files
export function cfImageUrl(imageId: string): string {
  if (!imageId) return "";
  if (imageId.startsWith("data:") || imageId.startsWith("http")) return imageId;
  return PUBLIC_URL ? `${PUBLIC_URL}/${imageId}` : imageId;
}
