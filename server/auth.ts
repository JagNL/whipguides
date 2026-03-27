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
