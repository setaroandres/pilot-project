/**
 * AIDEN feature flags.
 *
 * `aiden doctor` reads this to decide which env vars are required, and
 * `aiden upgrade` reads it to know which codemods to apply.
 *
 * IMPORTANT — keep the object literal below free of comments and
 * TypeScript-only syntax (`as const`, `as <type>`, etc). `aiden doctor`
 * parses it with a naive regex + JSON.parse (see
 * @upstart13-com/aiden-cli/dist/cli.js: parseTsConfigLiteral) that does
 * not strip comments or type casts — either one breaks the parse with a
 * confusing "Bad control character in string literal" error. Put any
 * explanatory notes here, in this header, instead of inside the literal.
 * (Raised as a candidate upstream fix for aiden-cli — a config file with
 * comments is normal TypeScript and shouldn't break its own doctor.)
 *
 * Field notes:
 * - version: AIDEN single-train version this app was last upgraded to.
 * - app: your app's identity. Placeholders below — replace with your
 *   product's real values. `NEXT_PUBLIC_APP_*` env vars override the
 *   name/tagline/copyright at runtime (see src/config/brand.ts).
 * - ai.providers: toggle providers with `enabled` and optionally pin a
 *   default `model`. When `model` is omitted, src/lib/ai.ts falls back
 *   to a built-in default. Set mock.enabled to use the built-in
 *   MockAIClient (no API key needed) — satisfies the graded "mock
 *   provider" requirement for the Meridian pilot.
 * - audit.enabled: Prisma sink registered in src/lib/audit.ts.
 * - rbac.enabled: roles seeded in prisma/seed.ts; rules in src/lib/abilities.ts.
 * - billing.enabled: toggle when wiring Stripe in src/lib/stripe.ts.
 * - email.enabled: toggle when wiring SendGrid in src/lib/email.ts.
 */

export const aidenConfig = {
  version: "2.0.1",

  app: {
    name: "Meridian Health AI Data Explorer",
    shortName: "meridian-explorer",
    tagline: "Natural-language analytics for Meridian Health Systems.",
    description: "Ask questions about patient outcomes, operational metrics, and financial performance - get instant SQL-backed answers.",
    supportEmail: "support@meridianhealth.example.com",
    url: "https://explorer.meridianhealth.example.com",
    companyLegalName: "Meridian Health Systems, Inc.",
    footerLinks: []
  },

  auth: {
    providers: {
      google: false,
      github: false,
      microsoft: false,
      credentials: true
    }
  },

  ai: {
    providers: {
      mock: { enabled: true },
      openai: { enabled: false, model: "gpt-4o-mini" },
      anthropic: { enabled: false, model: null },
      google: { enabled: false, model: null },
      mistral: { enabled: false, model: null },
      groq: { enabled: false, model: null },
      cohere: { enabled: false, model: null }
    }
  },

  audit: {
    enabled: true
  },

  rbac: {
    enabled: true
  },

  billing: {
    enabled: false
  },

  email: {
    enabled: false
  }
};

export type AidenConfig = typeof aidenConfig;
