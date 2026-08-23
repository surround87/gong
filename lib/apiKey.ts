export type Provider = "anthropic" | "deepseek";

const KEY = "gong:apiKey";
const PROVIDER = "gong:apiProvider";

export interface ProviderInfo {
  id: Provider;
  nome: string;
  prefisso: string;
  dove: string;
  nota: string;
  /** DeepSeek's Anthropic-compatible endpoint rejects `document` blocks. */
  leggePdf: boolean;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    nome: "Claude",
    prefisso: "sk-ant-",
    dove: "console.anthropic.com",
    nota: "Legge testo, foto e PDF.",
    leggePdf: true,
  },
  deepseek: {
    id: "deepseek",
    nome: "DeepSeek",
    prefisso: "sk-",
    dove: "platform.deepseek.com",
    nota: "Legge testo e foto. I PDF no.",
    leggePdf: false,
  },
};

export function getProvider(): Provider {
  if (typeof window === "undefined") return "anthropic";
  const v = window.localStorage.getItem(PROVIDER);
  return v === "deepseek" ? "deepseek" : "anthropic";
}

/**
 * The user's own key, kept on their device only. It is sent to /api/parse in a
 * request header (never a URL) and used for that one call — the server neither
 * stores nor logs it.
 */
export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setApiKey(value: string, provider: Provider) {
  window.localStorage.setItem(KEY, value.trim());
  window.localStorage.setItem(PROVIDER, provider);
}

export function clearApiKey() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(PROVIDER);
}

/** Shows enough to recognise the key without revealing it. */
export function maskApiKey(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}

/**
 * Cheap shape check so an obvious paste mistake is caught before a round trip.
 * An Anthropic key is a DeepSeek key with a longer prefix, so the DeepSeek
 * check has to exclude it rather than just match "sk-".
 */
export function looksLikeApiKey(value: string, provider: Provider): boolean {
  const v = value.trim();
  if (provider === "anthropic") return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v);
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(v) && !v.startsWith("sk-ant-");
}

/** Best guess when someone pastes before picking — used to preselect the card. */
export function indovinaProvider(value: string): Provider | null {
  const v = value.trim();
  if (v.startsWith("sk-ant-")) return "anthropic";
  if (v.startsWith("sk-")) return "deepseek";
  return null;
}
