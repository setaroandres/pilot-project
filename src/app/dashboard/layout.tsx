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

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const user = session.user as User & { id: string };

  const canManageUsers = abilities.can(session as never, "users.manage");
  const canViewCost    = abilities.can(session as never, "cost.view");

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
