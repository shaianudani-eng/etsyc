import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained app (concept-lock D14) — pin the root so Next never walks
  // up to an unrelated lockfile outside the monorepo.
  turbopack: { root: __dirname },
  // Keep the dev-tools badge out of /preview captures — the design-critic
  // reviews dev-server screenshots and the badge reads as stray UI.
  devIndicators: false,
  // Baseline hardening. No CSP here — the film layer's media pipeline needs
  // its own audit before locking sources; these four are uncontroversial.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
