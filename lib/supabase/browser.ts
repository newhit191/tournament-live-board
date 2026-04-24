"use client";

import { createBrowserClient } from "@supabase/ssr";

import { assertSupabasePublicConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = assertSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
