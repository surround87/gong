const KEY = "gong:apiKey";

/**
 * The user's own Anthropic key, kept on their device only. It is sent to
 * /api/parse in a request header (never a URL) and used for that one call —
 * the server neither stores nor logs it.
 */
export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setApiKey(value: string) {
  window.localStorage.setItem(KEY, value.trim());
}

export function clearApiKey() {
  window.localStorage.removeItem(KEY);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

/** Shows enough to recognise the key without revealing it. */
export function maskApiKey(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}

/** Cheap shape check so an obvious paste mistake is caught before a round trip. */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim());
}
