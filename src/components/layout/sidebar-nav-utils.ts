import type { NavItem } from "./sidebar-nav";

/**
 * Extract the path portion of a URL (without query string)
 */
export function hrefPath(href: string): string {
  const i = href.indexOf("?");
  return i === -1 ? href : href.slice(0, i);
}

/**
 * Extract query parameters from a URL, if any
 */
export function hrefQuery(href: string): URLSearchParams | null {
  const i = href.indexOf("?");
  if (i === -1) return null;
  return new URLSearchParams(href.slice(i + 1));
}

/**
 * Determine if a navigation item is active based on:
 * - Exact path match (when pathMatch === "exact")
 * - Path + query parameter match (when href contains query params)
 * - Prefix match (default, unless notActiveWhen condition is met)
 */
export function isNavActive(
  pathname: string,
  sp: URLSearchParams,
  item: NavItem
): boolean {
  const path = hrefPath(item.href);
  const required = hrefQuery(item.href);

  // Exact match mode
  if (item.pathMatch === "exact") {
    return pathname === path;
  }

  // Query parameter matching
  if (required) {
    if (pathname !== path) return false;
    for (const [k, v] of required.entries()) {
      if (sp.get(k) !== v) return false;
    }
    // Special case for /staff/students/new without intent param
    if (path === "/staff/students/new" && !required.has("intent")) {
      return !sp.get("intent");
    }
    return true;
  }

  // Prefix matching with notActiveWhen check
  if (pathname === path) {
    if (
      item.notActiveWhen &&
      sp.get(item.notActiveWhen.param) === item.notActiveWhen.value
    ) {
      return false;
    }
    return true;
  }

  // Prefix match for nested routes
  return path !== "/" && pathname.startsWith(`${path}/`);
}

/**
 * Determine if a parent navigation item should be active
 * (either its path matches or any of its children are active)
 */
export function isParentRegisterActive(
  pathname: string,
  sp: URLSearchParams,
  item: NavItem
): boolean {
  if (!item.children?.length) return false;
  if (pathname === hrefPath(item.href)) return true;
  return item.children.some((c) => isNavActive(pathname, sp, c));
}
