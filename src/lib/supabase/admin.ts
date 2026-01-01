import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRaw) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const service = serviceRaw.trim();

  return createClient(url, service, {
    global: {
      headers: {
        Authorization: `Bearer ${service}`,
        apikey: service,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
