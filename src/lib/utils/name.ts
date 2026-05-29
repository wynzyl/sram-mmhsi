/**
 * Name formatting utilities.
 *
 * Provides helpers for generating initials and formatting names.
 */

/**
 * Generate initials from a name string or first/last name pair.
 *
 * Supports multiple name formats:
 * - "Last, First" (comma-separated) -> "FL"
 * - "First Last" (space-separated) -> "FL"
 * - Single name -> first character
 *
 * @overload
 * @param name - Full name string (may be "Last, First" or "First Last" format)
 * @returns Two-character initials (uppercase) or "?" if empty
 *
 * @overload
 * @param first - First name
 * @param last - Last name
 * @returns Two-character initials (uppercase) or "?" if both empty
 *
 * @example
 * getInitials("Dela Cruz, Juan")  // "JD"
 * getInitials("Juan Dela Cruz")   // "JD"
 * getInitials("Juan", "Dela Cruz") // "JD"
 * getInitials("")                  // "?"
 */
export function getInitials(name: string): string;
export function getInitials(first: string, last: string): string;
export function getInitials(firstOrName: string, last?: string): string {
  // Two-argument form: (first, last)
  if (last !== undefined) {
    const a = firstOrName.trim().charAt(0);
    const b = last.trim().charAt(0);
    return `${a}${b}`.toUpperCase() || "?";
  }

  // Single-argument form: parse the name string
  const name = firstOrName;

  // Check for "Last, First" format
  const commaParts = name.split(",").map((s) => s.trim());
  if (commaParts.length >= 2) {
    const lastName = commaParts[0].charAt(0);
    const firstName = commaParts[1].charAt(0);
    return `${firstName}${lastName}`.toUpperCase() || "?";
  }

  // Check for "First Last" format (space-separated)
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }

  // Single name - return first character
  return name.charAt(0).toUpperCase() || "?";
}
