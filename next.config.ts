import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  async redirects() {
    return [
      { source: "/settings", destination: "/data-sources", permanent: true },
    ];
  },
};

export default nextConfig;
