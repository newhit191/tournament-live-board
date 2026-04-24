import { createClient } from "@supabase/supabase-js";

import { assertSupabaseServiceConfig } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = assertSupabaseServiceConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
