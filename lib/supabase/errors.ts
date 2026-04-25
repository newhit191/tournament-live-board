export function isSupabaseInvalidApiKeyError(error: unknown) {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.toLowerCase().includes("invalid api key");
}

