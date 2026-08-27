import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

// SSR/initial hydration snapshot — must match the server render to avoid a
// hydration mismatch. Desktop-first, same as the previous initial state.
function getServerSnapshot(): boolean {
  return false
}

/**
 * Hook to detect mobile viewport.
 *
 * Subscribes to the `matchMedia` store directly via `useSyncExternalStore`
 * instead of mirroring it into `useState` from an effect — the latter trips
 * `react-hooks/set-state-in-effect` and causes a cascading render on mount.
 *
 * Returns `false` during SSR and initial hydration, then the real value.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
