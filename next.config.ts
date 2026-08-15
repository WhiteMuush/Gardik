import type { NextConfig } from "next";

// Baseline security headers applied to every response. A strict CSP needs
// per-request nonces in the App Router and is tracked separately; these cover
// the framing, sniffing, referrer, transport, and feature-policy surface.
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
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Next 16.3 makes `next dev` append its own block to AGENTS.md on every run.
  // The block ships a non-ASCII character, which the pre-push ASCII gate
  // rejects, so the tree would go dirty on each dev start. We own that file.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/settings", destination: "/data-sources", permanent: true },
    ];
  },
};

export default nextConfig;
