"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Returns `false` during SSR and the first client paint, `true` once React has
 * hydrated. Used to gate submit buttons on financial forms: a pre-hydration
 * submit falls back to a full-page POST (progressive enhancement) — the server
 * action still runs, but the user gets no toast/redirect and may retry,
 * risking duplicate financial entries (Phase 11 audit finding F6).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
