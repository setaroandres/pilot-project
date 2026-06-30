"use client";

import type { ReactNode } from "react";
import type { User } from "next-auth";
import { Pin, BookOpen, DollarSign } from "lucide-react";
import {
  DashboardHeader,
  DashboardNav,
  Toaster,
  type DashboardNavItem,
  defaultNavIconRegistry,
} from "@upstart13-com/aiden-ui";
import type { Brand } from "@/config/brand";

// Built here in a "use client" module so Lucide forwardRef components never
// cross the Server → Client serialisation boundary.
const iconRegistry = {
  ...defaultNavIconRegistry,
  Pin,
  BookOpen,
  DollarSign,
};

interface DashboardShellProps {
  children:           ReactNode;
  user:               User & { id: string };
  brand:              Brand;
  primaryNavItems:    DashboardNavItem[];
  secondaryNavItems:  DashboardNavItem[];
  settingsHref:       string;
  showBilling:        boolean;
}

export function DashboardShell({
  children,
  user,
  brand,
  primaryNavItems,
  secondaryNavItems,
  settingsHref,
  showBilling,
}: DashboardShellProps) {
  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DashboardNav
        user={user}
        primaryNavItems={primaryNavItems}
        secondaryNavItems={secondaryNavItems}
        brand={brand}
        settingsHref={settingsHref}
        showBilling={showBilling}
        iconRegistry={iconRegistry}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          user={user}
          primaryNavItems={primaryNavItems}
          secondaryNavItems={secondaryNavItems}
          brand={brand}
          iconRegistry={iconRegistry}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster richColors />
    </div>
  );
}
