/**
 * App-wide static constants extracted from page and layout files.
 *
 * Keeping data separate from markup makes components easier to read and
 * lets content be updated without touching any JSX.
 *
 * Note: the nav icon registry lives in src/components/layout/dashboard-shell.tsx
 * because Lucide forwardRef components cannot cross the Server → Client
 * serialisation boundary and must be imported inside a "use client" module.
 */

import type { Metadata } from "next";
import { Sparkles, ShieldCheck, Zap, MessageSquare, Pin, BookOpen, BarChart3, Database } from "lucide-react";

// ---------------------------------------------------------------------------
// Page metadata — re-exported from each page as `export { xMeta as metadata }`
// Root layout metadata is excluded because it uses runtime values (brand, env).
// ---------------------------------------------------------------------------

export const loginPageMetadata:         Metadata = { title: "Sign In" };
export const registerPageMetadata:      Metadata = { title: "Create Account" };
export const overviewPageMetadata:      Metadata = { title: "Overview | Meridian Health AI Data Explorer" };
export const queryPageMetadata:         Metadata = { title: "Query | AI Data Explorer" };
export const conversationsPageMetadata: Metadata = { title: "Conversations | AI Data Explorer" };
export const pinsPageMetadata:          Metadata = { title: "Pins | AI Data Explorer" };
export const catalogPageMetadata:       Metadata = { title: "Catalog | AI Data Explorer" };
export const costPageMetadata:          Metadata = { title: "AI Cost | Admin" };

// ---------------------------------------------------------------------------
// Auth layout — value propositions shown on the left brand panel
// ---------------------------------------------------------------------------

export const authValueProps = [
  {
    icon:  Sparkles,
    title: "Natural-language queries",
    body:  "Ask questions in plain English — the AI translates them into validated SQL and returns results instantly.",
  },
  {
    icon:  ShieldCheck,
    title: "PHI-safe by design",
    body:  "A deny-list blocks SSN, DOB, MRN, and patient-name columns. All SQL is SELECT-only; no DDL ever reaches the database.",
  },
  {
    icon:  Zap,
    title: "Role-based access",
    body:  "Admins and Analysts query and pin results. Viewers browse saved insights. Every action is audit-logged.",
  },
];

// ---------------------------------------------------------------------------
// Dashboard overview — feature cards (linked tiles)
// ---------------------------------------------------------------------------

export const dashboardFeatures = [
  {
    icon:        Sparkles,
    title:       "Natural-Language Queries",
    href:        "/dashboard/query",
    description: "Ask questions in plain English — the AI translates them into validated SQL and returns results instantly.",
    badge:       "Core feature" as string | null,
  },
  {
    icon:        MessageSquare,
    title:       "Conversation History",
    href:        "/dashboard/conversations",
    description: "Every query session is saved. Follow-up questions carry context from the previous turns.",
    badge:       null as string | null,
  },
  {
    icon:        Pin,
    title:       "Pinned Visualizations",
    href:        "/dashboard/pins",
    description: "Save any query result as a named pin. Charts and data snapshots are stored for quick reference.",
    badge:       null as string | null,
  },
  {
    icon:        BookOpen,
    title:       "Data Catalog",
    href:        "/dashboard/catalog",
    description: "Browse every table and column exposed to the query engine, with business labels, definitions, and lineage.",
    badge:       null as string | null,
  },
];

// ---------------------------------------------------------------------------
// Dashboard overview — highlight cards (non-linked informational tiles)
// ---------------------------------------------------------------------------

export const dashboardHighlights = [
  {
    icon:  ShieldCheck,
    title: "PHI-safe by design",
    body:  "A deny-list blocks SSN, DOB, MRN, and patient-name columns from reaching the AI. SQL is validated before execution — SELECT-only, no DDL.",
  },
  {
    icon:  Database,
    title: "Three data domains",
    body:  "Patient outcomes (readmissions, LOS, satisfaction), operational metrics (bed occupancy, staff ratios, ER wait times), and financial performance (revenue, margins, cost per case).",
  },
  {
    icon:  BarChart3,
    title: "Role-based access",
    body:  "Admins and Analysts can run queries and pin results. Viewers see saved pins but cannot query. All actions are audit-logged.",
  },
];
