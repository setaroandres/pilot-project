import { createLogger } from "@upstart13-com/aiden-logging";

export const log = createLogger({
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "aiden-app",
  level: process.env.LOG_LEVEL as never,
  // pino-pretty is an optional dev dep. Two guards here:
  // 1. try/catch — package might not be installed.
  // 2. Path check — Turbopack intercepts require.resolve and returns its own
  //    internal module descriptor (e.g. "[externals]/pino-pretty [external]…")
  //    rather than a real filesystem path. Pino's fixTarget can't handle that
  //    format and throws. We only pass the target through when it resolves to
  //    an actual path (Unix absolute or Windows drive letter).
  transport: (() => {
    if (process.env.NODE_ENV === "production") return undefined;
    try {
      const target = require.resolve("pino-pretty");
      const isRealPath = target.startsWith("/") || /^[A-Za-z]:[/\\]/.test(target);
      if (!isRealPath) return undefined;
      return { target, options: { colorize: true } };
    } catch {
      return undefined;
    }
  })(),
});
