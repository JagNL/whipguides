import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin, supabaseClient } from "./supabase";
import { storage } from "./storage";

// ============================================================
// AUTH MIDDLEWARE
// Verifies Supabase JWT token from Authorization header
// Attaches req.user (our public profile) if valid
// ============================================================
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized — no token provided" });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized — invalid token" });
  }

  // Attach auth user to request
  (req as any).authUser = user;

  // Look up our public profile
  const profile = await storage.getUserByAuthId(user.id);
  if (profile) {
    (req as any).currentUser = profile;
  }

  next();
}

// Optional auth — attaches user if token present but doesn't block
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      (req as any).authUser = user;
      const profile = await storage.getUserByAuthId(user.id);
      if (profile) (req as any).currentUser = profile;
    }
  }
  next();
}

// ============================================================
// AUTH ROUTES HANDLER
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/logout
// GET  /api/auth/me
// ============================================================
import { Router } from "express";
export const authRouter = Router();

// Register
authRouter.post("/register", async (req, res) => {
  const { email, password, username, displayName } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, password, and username are required" });
  }

  // Check username taken
  const existing = await storage.getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ error: "Username already taken" });
  }

  // Create Supabase auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation for now
    user_metadata: { username, display_name: displayName || username },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // The trigger in Supabase will auto-create the public profile,
  // but we create it here too as a fallback
  let profile = await storage.getUserByAuthId(data.user.id);
  if (!profile) {
    profile = await storage.createUser({
      username,
      displayName: displayName || username,
      memberSince: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      authId: data.user.id,
      email,
    });
  }

  // Sign in to get session token
  const { data: session, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (signInError) {
    return res.status(500).json({ error: "Account created but sign-in failed" });
  }

  res.json({
    user: profile,
    session: {
      access_token: session.session?.access_token,
      refresh_token: session.session?.refresh_token,
      expires_at: session.session?.expires_at,
    },
  });
});

// Login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const profile = await storage.getUserByAuthId(data.user.id);

  // Block banned users
  if ((profile as any)?.banned) {
    return res.status(403).json({ error: "Your account has been suspended. Contact support@whipguides.com" });
  }

  res.json({
    user: profile,
    session: {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at,
    },
  });
});

// Logout
authRouter.post("/logout", requireAuth, async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) await supabaseAdmin.auth.admin.signOut(token);
  res.json({ success: true });
});

// Get current user
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).currentUser;
  res.json({ user });
});

// OAuth session exchange — client sends Supabase access_token from OAuth redirect
// We verify it, auto-create a profile if needed, return our session
authRouter.post("/oauth", async (req, res) => {
  const { access_token, refresh_token, expires_at } = req.body;
  if (!access_token) return res.status(400).json({ error: "access_token required" });

  // Verify the token
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  // Find or create profile
  let profile = await storage.getUserByAuthId(user.id);
  if (!profile) {
    // Auto-generate username from email or provider metadata
    const meta = user.user_metadata || {};
    const rawName = meta.full_name || meta.name || meta.preferred_username || user.email?.split("@")[0] || "user";
    const baseUsername = rawName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) || "user";
    // Make username unique
    let username = baseUsername;
    let attempt = 0;
    while (await storage.getUserByUsername(username)) {
      attempt++;
      username = `${baseUsername}${attempt}`;
    }
    const displayName = meta.full_name || meta.name || rawName;
    const avatar = meta.avatar_url || meta.picture || null;
    profile = await storage.createUser({
      username,
      displayName,
      avatar,
      memberSince: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      authId: user.id,
      email: user.email,
    });
  }

  if ((profile as any)?.banned) {
    return res.status(403).json({ error: "Your account has been suspended." });
  }

  res.json({
    user: profile,
    session: { access_token, refresh_token, expires_at },
  });
});

// Refresh token
authRouter.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "refresh_token required" });

  const { data, error } = await supabaseClient.auth.refreshSession({ refresh_token });
  if (error || !data.session) return res.status(401).json({ error: "Invalid refresh token" });

  res.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
});

// ============================================================
// MFA ENDPOINTS
// All use Supabase Auth MFA — we are the relay, Supabase does crypto
// ============================================================

// GET /api/auth/mfa/status — check current user’s MFA factors
authRouter.get("/mfa/status", requireAuth, async (req, res) => {
  const authUser = (req as any).authUser;
  const profile = (req as any).currentUser;

  const { data: factors } = await supabaseAdmin.auth.mfa.listFactors({ userId: authUser.id } as any);
  const totpFactors = (factors?.totp || []).filter((f: any) => f.status === "verified");
  const webauthnFactors = (factors?.webauthn || []).filter((f: any) => f.status === "verified");

  res.json({
    mfaEnabled: (profile as any)?.mfaEnabled || false,
    mfaRequired: (profile as any)?.mfaRequired || false,
    factors: {
      totp: (factors?.totp || []).map((f: any) => ({ id: f.id, name: f.friendly_name || "Authenticator App", status: f.status, createdAt: f.created_at })),
      webauthn: (factors?.webauthn || []).map((f: any) => ({ id: f.id, name: f.friendly_name || "Passkey", status: f.status, createdAt: f.created_at })),
    },
    hasVerifiedFactor: totpFactors.length > 0 || webauthnFactors.length > 0,
  });
});

// POST /api/auth/mfa/enroll — start enrolling a new TOTP factor
// Returns QR code URI + secret for scanning with authenticator app
authRouter.post("/mfa/enroll", requireAuth, async (req, res) => {
  const { factorType = "totp", friendlyName } = req.body;
  const authUser = (req as any).authUser;

  if (!(["totp", "webauthn"].includes(factorType))) {
    return res.status(400).json({ error: "factorType must be totp or webauthn" });
  }

  // Use the user’s Supabase access token for MFA operations
  const token = req.headers.authorization?.replace("Bearer ", "");
  const userClient = (await import("./supabase")).createUserClient?.(token || "");

  // Supabase MFA enroll requires the user’s own session (not admin)
  // We call the Supabase MFA API directly
  const supabaseUrl = process.env.SUPABASE_URL!;
  const resp = await fetch(`${supabaseUrl}/auth/v1/factors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_ANON_KEY!,
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      factor_type: factorType,
      friendly_name: friendlyName || (factorType === "totp" ? "Authenticator App" : "Passkey"),
      issuer: "WhipGuides",
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return res.status(resp.status).json({ error: err.message || "Enrollment failed" });
  }

  const data = await resp.json();
  // data contains: id, type, totp.qr_code, totp.secret, totp.uri
  res.json(data);
});

// POST /api/auth/mfa/verify — verify a TOTP code to complete enrollment OR as a challenge
authRouter.post("/mfa/verify", requireAuth, async (req, res) => {
  const { factorId, challengeId, code } = req.body;
  if (!factorId || !code) return res.status(400).json({ error: "factorId and code required" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  const supabaseUrl = process.env.SUPABASE_URL!;

  // Step 1: Create a challenge for this factor
  let cId = challengeId;
  if (!cId) {
    const challengeResp = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}/challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_ANON_KEY!,
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!challengeResp.ok) {
      const err = await challengeResp.json();
      return res.status(challengeResp.status).json({ error: err.message || "Challenge creation failed" });
    }
    const challengeData = await challengeResp.json();
    cId = challengeData.id;
  }

  // Step 2: Verify the code against the challenge
  const verifyResp = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_ANON_KEY!,
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ challenge_id: cId, code }),
  });

  if (!verifyResp.ok) {
    const err = await verifyResp.json();
    return res.status(verifyResp.status).json({ error: err.message || "Verification failed" });
  }

  const data = await verifyResp.json();

  // Mark user as MFA-enabled in our DB
  const authUser = (req as any).authUser;
  const profile = (req as any).currentUser;
  if (profile) {
    await supabaseAdmin.from("users")
      .update({ mfa_enabled: true })
      .eq("id", profile.id);
  }

  res.json({ success: true, session: data.session || null });
});

// POST /api/auth/mfa/challenge — create a challenge for an existing factor
authRouter.post("/mfa/challenge", requireAuth, async (req, res) => {
  const { factorId } = req.body;
  if (!factorId) return res.status(400).json({ error: "factorId required" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  const supabaseUrl = process.env.SUPABASE_URL!;

  const resp = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}/challenge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_ANON_KEY!,
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = await resp.json();
    return res.status(resp.status).json({ error: err.message || "Challenge failed" });
  }

  res.json(await resp.json());
});

// DELETE /api/auth/mfa/factors/:id — unenroll a factor
authRouter.delete("/mfa/factors/:id", requireAuth, async (req, res) => {
  const authUser = (req as any).authUser;
  const profile = (req as any).currentUser;

  // Unenroll via admin API
  const { error } = await supabaseAdmin.auth.mfa.unenroll({
    userId: authUser.id,
    factorId: req.params.id,
  } as any);

  if (error) return res.status(400).json({ error: error.message });

  // Check if user still has any verified factors
  const { data: factors } = await supabaseAdmin.auth.mfa.listFactors({ userId: authUser.id } as any);
  const hasAny = (factors?.totp || []).some((f: any) => f.status === "verified") ||
                 (factors?.webauthn || []).some((f: any) => f.status === "verified");

  if (!hasAny && profile) {
    await supabaseAdmin.from("users").update({ mfa_enabled: false }).eq("id", profile.id);
  }

  res.json({ success: true });
});

// ============================================================
// MFA MIDDLEWARE
// requireMFA: blocks access if user has MFA enabled but
// current token was not issued after MFA challenge.
// For admin routes: super_admins with no MFA enrolled get a
// warning but are not blocked (grace period to enroll).
// ============================================================
export async function requireMFA(req: Request, res: Response, next: NextFunction) {
  const authUser = (req as any).authUser;
  const currentUser = (req as any).currentUser;
  if (!authUser || !currentUser) return res.status(401).json({ error: "Unauthorized" });

  const { isSuperAdminEmail } = await import("./admin");
  const isOwnerEmail = isSuperAdminEmail(authUser.email);
  const isSuperAdmin = isOwnerEmail || currentUser.siteRole === "super_admin";

  // If not an admin, MFA is optional — skip check
  if (!isSuperAdmin) return next();

  // Check if user has MFA enrolled
  const { data: factors } = await supabaseAdmin.auth.mfa.listFactors({ userId: authUser.id } as any).catch(() => ({ data: null }));
  const hasVerifiedFactor = (
    (factors?.totp || []).some((f: any) => f.status === "verified") ||
    (factors?.webauthn || []).some((f: any) => f.status === "verified")
  );

  // Super admin has no MFA enrolled — warn but allow (grace period)
  if (!hasVerifiedFactor) {
    // Attach warning to response headers so client can show a banner
    res.setHeader("X-MFA-Warning", "super_admin_no_mfa");
    return next();
  }

  // Check AAL (Authenticator Assurance Level) on the JWT
  // Supabase sets aal2 when MFA was verified in this session
  const aal = authUser?.factors?.length > 0 ? "aal2" : "aal1";
  // More reliable: check Supabase session AAL via getUser response
  const userAal = (authUser as any)?.aal || "aal1";

  if (userAal !== "aal2") {
    return res.status(403).json({
      error: "MFA verification required",
      code: "MFA_REQUIRED",
      message: "Your account requires multi-factor authentication to access admin features. Please verify your second factor.",
    });
  }

  next();
}
