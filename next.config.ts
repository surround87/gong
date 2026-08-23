import type { NextConfig } from "next";

// Not a static export: /api/parse runs server-side so the Anthropic API key
// never reaches the browser. Vercel serves the app routes statically anyway.
const nextConfig: NextConfig = {
  env: {
    // Baked in at build time, shown on the key screen. Makes it possible to
    // tell which build a device is actually running instead of guessing.
    NEXT_PUBLIC_BUILD: new Date().toISOString().slice(0, 16).replace("T", " "),
  },
};

export default nextConfig;
