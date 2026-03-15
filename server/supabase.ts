import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — using in-memory storage fallback");
}

// Service role client (backend only — bypasses RLS for admin operations)
export const supabaseAdmin = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseServiceKey || "placeholder");

// Anon client (for auth operations)
export const supabaseClient = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");

export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseServiceKey);
