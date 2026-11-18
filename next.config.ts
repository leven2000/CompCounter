import type { NextConfig } from "next";

const desktop = process.env.COMPCOUNTER_DESKTOP === "1";

const nextConfig: NextConfig = {
  output: desktop ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
