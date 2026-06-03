import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "node-ical", "firebase-admin", "resend", "twilio", "stripe", "@aws-sdk/client-sesv2", "@google/genai", "openai", "posthog-node"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "framer-motion"],
    // Cache client-side navigations so going back to a visited page is instant
    staleTimes: {
      dynamic: 0,  // always fetch fresh data on client-side navigation
    },
  },
  /**
   * Security headers applied to all responses. We deliberately keep CSP
   * out of here for now — strict CSP needs nonce wiring through every
   * Next.js component that emits inline styles, and getting it wrong
   * breaks the app in subtle ways. HSTS / frame / content-type / referrer
   * are the cheap-but-meaningful wins.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS for a year. Doesn't help unauth'd attackers but
          // protects users who type the bare domain after first visit.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Stop the app from being framed by other sites — defends against
          // clickjacking on /pipeline, /contacts, etc.
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers from MIME-sniffing uploads
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't send full URL as referrer to other origins
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Limit powerful browser APIs we don't use
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ]
  },
  /**
   * Redirects for the IA reorganization (May 2026):
   * - /email-marketing/* → /marketing/email/*
   * - /social* → /marketing/social
   * - /reporting/marketing → /marketing/analytics
   * - /referral-payout/* → /payout/* (kept public; lifted out of /finance/)
   * - /dashboard/forecasting → /finance/forecasting
   * - /dashboard/commissions → /finance/commissions
   * - /dashboard/referrals → /finance/referrals
   *
   * 308 (permanent) so search engines and bookmarks update.
   */
  async redirects() {
    return [
      { source: "/email-marketing", destination: "/marketing/email", permanent: true },
      { source: "/email-marketing/:path*", destination: "/marketing/email/:path*", permanent: true },
      { source: "/social", destination: "/marketing/social", permanent: true },
      { source: "/social/:path*", destination: "/marketing/social/:path*", permanent: true },
      { source: "/reporting", destination: "/dashboard", permanent: true },
      { source: "/reporting/marketing", destination: "/marketing/analytics", permanent: true },
      { source: "/referral-payout/:token", destination: "/payout/:token", permanent: true },
      { source: "/dashboard/forecasting", destination: "/finance/forecasting", permanent: true },
      { source: "/dashboard/commissions", destination: "/finance/commissions", permanent: true },
      { source: "/dashboard/referrals", destination: "/finance/referrals", permanent: true },
      // Settings consolidation (May 2026): purged sub-routes → consolidated parents
      { source: "/settings/customization", destination: "/settings/workspace", permanent: true },
      { source: "/settings/developer", destination: "/settings/integrations", permanent: true },
      { source: "/settings/audit", destination: "/settings/team", permanent: true },
      { source: "/settings/changelog", destination: "/changelog", permanent: true },
      // /settings/automation purged: workflows + follow-ups belong in the
      // proper /automations canvas; scheduled reports went to /finance/reports.
      { source: "/settings/automation", destination: "/automations", permanent: true },
      // Settings IA reorg (May 2026): old query-string tabs → new sub-routes
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "profile" }],
        destination: "/settings/profile",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "branding" }],
        destination: "/settings/branding",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "workspace" }],
        destination: "/settings/workspace",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "users" }],
        destination: "/settings/team",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "integrations" }],
        destination: "/settings/integrations",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "automations" }],
        destination: "/automations",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "custom-fields" }],
        destination: "/settings/workspace",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "lead-forms" }],
        destination: "/settings/workspace",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "api-keys" }],
        destination: "/settings/integrations",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "reports" }],
        destination: "/finance/reports",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "workflows" }],
        destination: "/automations",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "assignment" }],
        destination: "/settings/team",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "audit" }],
        destination: "/settings/team",
        permanent: true,
      },
      {
        source: "/settings",
        has: [{ type: "query", key: "tab", value: "changelog" }],
        destination: "/changelog",
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

/**
 * Wrap with Sentry for source-map upload + ad-blocker-resistant tunneling.
 * Only kicks in when SENTRY_AUTH_TOKEN is set (build-time only); the runtime
 * SDK in sentry.*.config.ts works on its own regardless.
 */
const wrappedConfig = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      disableLogger: true,
    })
  : nextConfig;

export default withBundleAnalyzer(wrappedConfig);
