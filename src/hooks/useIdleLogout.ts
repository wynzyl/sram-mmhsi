"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateActivityAction } from "@/features/auth/auth.actions";

// Default values (will be synced with server on first activity update)
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes
const ACTIVITY_DEBOUNCE_MS = 30 * 1000; // Debounce activity updates to server (30 seconds)

// Activity events to track
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

export interface UseIdleLogoutOptions {
  /** Whether idle tracking is enabled (e.g., only for authenticated users) */
  enabled?: boolean;
  /** Callback when warning dialog should be shown */
  onWarning?: (remainingMs: number) => void;
  /** Callback when logout is triggered */
  onLogout?: () => void;
}

export interface UseIdleLogoutReturn {
  /** Time remaining before logout (in ms) */
  remainingMs: number;
  /** Whether the warning dialog should be shown */
  showWarning: boolean;
  /** Reset the idle timer (e.g., when user clicks "Stay Logged In") */
  resetTimer: () => void;
  /** Force immediate logout */
  logout: () => void;
}

export function useIdleLogout(options: UseIdleLogoutOptions = {}): UseIdleLogoutReturn {
  const { enabled = true, onWarning, onLogout } = options;
  const router = useRouter();

  // Timer configuration (synced with server)
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(DEFAULT_IDLE_TIMEOUT_MS);
  const [warningBeforeMs, setWarningBeforeMs] = useState(DEFAULT_WARNING_BEFORE_MS);

  // State
  const [remainingMs, setRemainingMs] = useState(DEFAULT_IDLE_TIMEOUT_MS);
  const [showWarning, setShowWarning] = useState(false);

  // Refs for timers and activity tracking
  // Initialize with 0; will be set to Date.now() in effect to avoid impure render
  const lastActivityRef = useRef<number>(0);
  const lastServerUpdateRef = useRef<number>(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOutRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Handle logout
  const logout = useCallback(() => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    onLogout?.();
    router.push("/login?idle=true");
  }, [onLogout, router]);

  // Update activity on server (debounced) - returns void for sync external calls
  const updateServerActivity = useCallback(() => {
    const now = Date.now();
    // Debounce: only update server if enough time has passed since last update
    if (now - lastServerUpdateRef.current < ACTIVITY_DEBOUNCE_MS) {
      return;
    }

    lastServerUpdateRef.current = now;

    // Fire and forget - we don't want to block on this
    updateActivityAction()
      .then((result) => {
        if (result.ok) {
          // Sync timeout configuration with server
          if (result.idleTimeoutMs) {
            setIdleTimeoutMs(result.idleTimeoutMs);
          }
          if (result.warningBeforeMs) {
            setWarningBeforeMs(result.warningBeforeMs);
          }
        } else {
          // Session is invalid, trigger logout
          if (!isLoggingOutRef.current) {
            isLoggingOutRef.current = true;
            onLogout?.();
            router.push("/login?idle=true");
          }
        }
      })
      .catch(() => {
        // Network error - continue with local timer
        // Don't log out on network errors as the session may still be valid
      });
  }, [onLogout, router]);

  // Reset the idle timer (called on user activity or "Stay Logged In")
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setRemainingMs(idleTimeoutMs);
    setShowWarning(false);
    // Update server activity
    updateServerActivity();
  }, [idleTimeoutMs, updateServerActivity]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;

    const now = Date.now();
    lastActivityRef.current = now;

    // If warning was showing, hide it and reset timer
    if (showWarning) {
      setShowWarning(false);
    }

    // Update remaining time
    setRemainingMs(idleTimeoutMs);

    // Debounced server update
    updateServerActivity();
  }, [enabled, idleTimeoutMs, showWarning, updateServerActivity]);

  // Initialize and set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    // Initialize lastActivityRef on mount (avoids impure render)
    if (!isInitializedRef.current) {
      lastActivityRef.current = Date.now();
      isInitializedRef.current = true;
      // Initial server sync - fire and forget
      updateServerActivity();
    }

    // Add activity event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start countdown interval (check every second)
    countdownIntervalRef.current = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const remaining = Math.max(0, idleTimeoutMs - elapsed);

      setRemainingMs(remaining);

      // Show warning when approaching timeout
      if (remaining <= warningBeforeMs && remaining > 0 && !showWarning) {
        setShowWarning(true);
        onWarning?.(remaining);
      }

      // Trigger logout when time expires
      if (remaining === 0) {
        logout();
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [enabled, handleActivity, idleTimeoutMs, warningBeforeMs, showWarning, onWarning, logout, updateServerActivity]);

  return {
    remainingMs,
    showWarning,
    resetTimer,
    logout,
  };
}
