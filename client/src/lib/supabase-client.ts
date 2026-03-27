/**
 * Browser-side Supabase client — used ONLY for OAuth flows.
 * All data access goes through the Express backend (which uses supabaseAdmin).
 * SUPABASE_URL and SUPABASE_ANON_KEY are fetched from /api/config at runtime
 * (same pattern as CF images URL — avoids VITE_ build-time env vars).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiRequest } from "./queryClient";

let _client: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (_client) return _client;
  const res = await apiRequest("GET", "/api/config");
  const config = await res.json();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase config not available");
  }
  _client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false }, // we manage sessions ourselves
  });
  return _client;
}
