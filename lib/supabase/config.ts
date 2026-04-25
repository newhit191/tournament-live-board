function readEnv(name: string) {
  const raw = process.env[name]?.trim() ?? "";
  if (!raw) return "";
  if (
    (raw.startsWith("\"") && raw.endsWith("\"")) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sanitizeSupabaseUrl(value: string) {
  if (!value) return "";
  if (!looksLikeUrl(value)) return "";
  return value.replace(/\/+$/, "");
}

function sanitizeSupabaseKey(value: string) {
  if (!value) return "";
  // 防呆：有人把 URL 貼到 key 欄位時，直接視為無效 key
  if (looksLikeUrl(value)) return "";
  return value;
}

export function getSupabaseConfig() {
  const url = sanitizeSupabaseUrl(
    readEnv("NEXT_PUBLIC_SUPABASE_URL") || readEnv("SUPABASE_URL"),
  );

  const anonKey = sanitizeSupabaseKey(
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
      readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      readEnv("SUPABASE_ANON_KEY"),
  );

  const serviceRoleKey = sanitizeSupabaseKey(
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ||
      readEnv("SUPABASE_SECRET_KEY") ||
      readEnv("SUPABASE_SERVICE_KEY"),
  );

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
    throw new Error("Supabase 公開環境變數尚未設定完成。");
  }

  return config;
}

export function assertSupabaseServiceConfig() {
  const config = getSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase Service Role 金鑰尚未設定完成。");
  }

  return config;
}

export function getMissingSupabaseEnvs() {
  const missing: string[] = [];
  const config = getSupabaseConfig();

  if (!config.url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!config.anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!config.serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}
