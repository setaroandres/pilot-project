import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { User } from "next-auth";
import { type DashboardNavItem } from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { brand } from "@/config/brand";
import { aidenConfig } from "@/../aiden.config";
import {
  primaryNavItems,
  settingsNavItem,
  adminUsersNavItem,
  adminCostNavItem,
} from "@/config/nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Segment guard for everything under `/admin`. This is the safe default:
 * any page added under `admin/` is protected without remembering to copy a
 * per-page redirect block. Pages keep their own ability check as
 * defense-in-depth, but the layout is the backstop.
 *
 * Unauthenticated users go to /login; authenticated users without an admin
 * ability go to /dashboard.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");

  const canManageUsers = abilities.can(session as never, "users.manage");
  const canViewCost    = abilities.can(session as never, "cost.view");
  const canReadAudit   = abilities.can(session as never, "audit.read");

  if (!canManageUsers && !canReadAudit) {
    redirect("/dashboard");
  }

  const user = session.user as User & { id: string };

  const adminItems: DashboardNavItem[] = [
    ...(canManageUsers ? [adminUsersNavItem] : []),
    ...(canViewCost    ? [adminCostNavItem]  : []),
  ];
  const secondaryNavItems: DashboardNavItem[] = [...adminItems, settingsNavItem];

  return (
    <DashboardShell
      user={user}
      brand={brand}
      primaryNavItems={primaryNavItems}
      secondaryNavItems={secondaryNavItems}
      settingsHref={settingsNavItem.href}
      showBilling={aidenConfig.billing.enabled}
    >
      {children}
    </DashboardShell>
  );
}
