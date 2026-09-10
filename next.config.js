/** @type {import('next').NextConfig} */

// Applied to every response. These are the headers that don't risk breaking
// the app; a strict Content-Security-Policy is deliberately left out, because
// Next's inline bootstrap scripts need per-request nonces and a half-configured
// CSP tends to either break the app or lull you into thinking you're covered.
const securityHeaders = [
  // Don't let the site be framed — defeats clickjacking, where an attacker
  // overlays an invisible copy of your ledger and harvests your clicks.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stop browsers from second-guessing declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full URL only to this origin; other sites see just the origin,
  // so query strings never leak outward.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app asks for none of these; deny them so injected code can't either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HTTPS only, including subdomains. Vercel sets this too; being explicit
  // keeps it true anywhere else this is deployed.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to anyone scanning for known bugs.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
