import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained app (concept-lock D14) — pin the root so Next never walks
  // up to an unrelated lockfile outside the monorepo.
  turbopack: { root: __dirname },
  // Keep the dev-tools badge out of /preview captures — the design-critic
  // reviews dev-server screenshots and the badge reads as stray UI.
  devIndicators: false,
};

export default nextConfig;
