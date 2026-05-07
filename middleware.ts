import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

/** Next.js entry — delegates to `proxy` (route guard + role redirects). */
export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};
