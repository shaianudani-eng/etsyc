import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained app (concept-lock D14) — pin the root so Next never walks
  // up to an unrelated lockfile outside the monorepo. Both knobs must agree,
  // or Next warns and picks its own tracing root on Vercel builds.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Keep the dev-tools badge out of /preview captures — the design-critic
  // reviews dev-server screenshots and the badge reads as stray UI.
  devIndicators: false,
};

export default nextConfig;
