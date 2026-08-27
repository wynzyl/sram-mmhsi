import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Hook to detect mobile viewport.
 * Returns `false` during SSR and initial hydration to prevent hydration mismatch.
 * Updates to actual value after mount.
 */
export function useIsMobile(): boolean {
  // Use false as initial value to match SSR (prevents hydration mismatch)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Set actual value after mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
