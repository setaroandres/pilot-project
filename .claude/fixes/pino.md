# pino-pretty transport crash in Next.js dev

## Symptom
Every API route returns 500 on first request with:
```
Error: unable to determine transport target for "pino-pretty"
```

## Root cause
`pino-pretty` is an optional dev dependency. If it is not installed, pino's
worker-thread transport spawner throws at logger module initialization time,
which crashes the Next.js server chunk that imports `src/lib/logger.ts`
(i.e. every API route via `withAuth`).

Even when installed, passing `target: "pino-pretty"` as a bare string can fail
under Turbopack because the worker can't resolve a relative module name from
inside the bundled chunk.

## Fix
1. Install the package: `npm install -D pino-pretty`
2. Use `require.resolve("pino-pretty")` to give pino an absolute path, wrapped
   in a `try/catch` so the app degrades gracefully (plain JSON logs) if the
   package is missing:

```ts
transport: (() => {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    const target = require.resolve("pino-pretty");
    return { target, options: { colorize: true } };
  } catch {
    return undefined;
  }
})(),
```

## Turbopack rewrites require.resolve path for pino-pretty

**Symptom** (after installing pino-pretty):
```
Error: unable to determine transport target for
  "[externals]/pino-pretty [external] (pino-pretty, cjs, ...)"
```

**Cause**
Turbopack intercepts `require.resolve("pino-pretty")` and returns its own
internal module descriptor instead of the real filesystem path. Pino's
`fixTarget` only accepts real paths and throws on this format.

**Fix**
Check that the resolved path is a real filesystem path before passing it to
pino. If Turbopack's mangled path is detected, return `undefined` (plain JSON
logging) instead:

```ts
const target = require.resolve("pino-pretty");
const isRealPath = target.startsWith("/") || /^[A-Za-z]:[/\\]/.test(target);
if (!isRealPath) return undefined;
return { target, options: { colorize: true } };
```

In practice this means pino-pretty pretty-printing is disabled under Turbopack
dev mode. Logs are still emitted as NDJSON to stdout.
