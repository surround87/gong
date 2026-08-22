import type { NextConfig } from "next";

// Not a static export: /api/parse runs server-side so the Anthropic API key
// never reaches the browser. Vercel serves the app routes statically anyway.
const nextConfig: NextConfig = {};

export default nextConfig;
