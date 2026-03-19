import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing env var SUPABASE_URL");
  }
  if (!key) {
    throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
  }

  // Service role côté serveur uniquement (API routes).
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

