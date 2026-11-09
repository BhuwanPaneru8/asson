import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // separate build folders let E2E tests run a production build next to the dev server
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Classic caching model: pages render per request; hot catalogue queries use unstable_cache + tags.
  cacheComponents: false,
  poweredByHeader: false,
  // self-hosted: `.next/standalone` holds server.js + only the node_modules it needs (see deploy/)
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  env: { ASSON_ENV: process.env.ASSON_ENV ?? "", ASSON_RELEASE: process.env.ASSON_RELEASE ?? process.env.GITHUB_SHA?.slice(0, 7) ?? "dev" },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.ASSON_ENV === "staging" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
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
