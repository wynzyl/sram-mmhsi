/**
 * Structured application logger for SRAMS.
 * Per SRAMS Engineering spec §14 — Observability Procedure.
 * Emits JSON-structured logs in production, human-readable in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  correlationId?: string;
  userId?: string;
  role?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  ip?: string;
  errorCode?: string;
  [key: string]: unknown;
};

const isDev = process.env.NODE_ENV !== "production";

function formatEntry(level: LogLevel, message: string, ctx?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
  };
  return isDev ? entry : JSON.stringify(entry);
}

export const logger = {
  debug(message: string, ctx?: LogContext) {
    if (isDev) console.debug(formatEntry("debug", message, ctx));
  },
  info(message: string, ctx?: LogContext) {
    console.info(formatEntry("info", message, ctx));
  },
  warn(message: string, ctx?: LogContext) {
    console.warn(formatEntry("warn", message, ctx));
  },
  error(message: string, ctx?: LogContext) {
    console.error(formatEntry("error", message, ctx));
  },
};
