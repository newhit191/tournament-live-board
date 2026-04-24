function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getSupabaseConfig() {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url,
    anonKey,
    serviceRoleKey,
    isReady: Boolean(url && anonKey),
    isServiceReady: Boolean(url && serviceRoleKey),
  };
}

export function assertSupabasePublicConfig() {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    throw new Error("Supabase 公開環境變數未設定完整。");
  }

  return config;
}

export function assertSupabaseServiceConfig() {
  const config = getSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase Service Role 環境變數未設定完整。");
  }

  return config;
}
