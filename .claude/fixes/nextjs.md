# Next.js & App Router Fixes

- **[2026-02-12]** `useSearchParams()` in a page component causes build error `useSearchParams() should be wrapped in a suspense boundary` → In Next.js 15+, pages that use `useSearchParams()` must wrap the consuming component in a `<Suspense>` boundary. Extract the page content into a separate component (e.g., `PageContent`) and wrap it with `<Suspense fallback={...}>` in the default export page component.
- **[2026-02-12]** `window.history.replaceState()` inside a `useEffect` that depends on `[searchParams]` causes the effect to immediately re-run and cleanup → In Next.js 14+, `replaceState`/`pushState` are intercepted and sync with `useSearchParams()`. If you clean URL params via `replaceState` at the top of an effect that depends on `searchParams`, the params change triggers re-run. Fix: defer URL cleaning until inside the async callback (after capturing the params), or use a `useRef` to store params before cleaning.
- **[2026-02-15]** `npm run build` fails with `Cannot find module './XXXX.js'` in `.next/server/webpack-runtime.js` → This is a stale Next.js build cache issue, not a code error. TypeScript compilation and linting succeed but the "Collecting page data" step fails on a missing chunk. Fix: delete `.next/` directory (`rm -rf .next`) and rebuild.

## Cannot pass icon registry (Lucide components) from Server → Client

**Symptom**
```
Only plain objects can be passed to Client Components from Server Components.
Classes or other objects with methods are not supported.
  {Pin: {$$typeof: ..., render: ...}, ...}
```

**Cause**
`DashboardNav` / `DashboardHeader` are Client Components. Passing an
`iconRegistry` prop (which contains Lucide `forwardRef` components) from a
Server Component layout causes Next.js's RSC serialiser to throw because
React component objects are not plain-object-serialisable.

The `@upstart13-com/aiden-ui` nav docs explicitly warn about this — nav items
use string icon names precisely to avoid shipping forwardRef objects across
the boundary.

**Fix**
Build the registry in a `"use client"` wrapper component. The server layout
passes only plain-serialisable props to it:

```tsx
// src/components/layout/dashboard-shell.tsx  ("use client")
import { Pin, BookOpen, DollarSign } from "lucide-react";
import { defaultNavIconRegistry } from "@upstart13-com/aiden-ui";
const iconRegistry = { ...defaultNavIconRegistry, Pin, BookOpen, DollarSign };
// render DashboardNav / DashboardHeader with iconRegistry here
```

```tsx
// src/app/dashboard/layout.tsx  (server component)
// passes only DashboardNavItem[], strings, booleans — no components
return <DashboardShell primaryNavItems={...} ...>{children}</DashboardShell>;
```
