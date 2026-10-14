import type { NextConfig } from "next"

// Baseline headers on every response; the strict CSP with its per-request nonce lives in src/lib/csp.ts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

const nextConfig: NextConfig = {
  // Self-contained .next/standalone bundle, so the Docker image ships without node_modules.
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // No next/image in the app, so the optimizer and its sharp binaries stay out of the image.
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  // Stops `next dev` appending a non-ASCII block to AGENTS.md on every run.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  async redirects() {
    return [{ source: "/settings", destination: "/data-sources", permanent: true }]
  },
}

export default nextConfig
