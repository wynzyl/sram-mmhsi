/**
 * Dynamic File Server for Uploaded Content
 *
 * Serves files from the uploads directory via API route.
 * This is necessary because Next.js standalone mode does NOT serve
 * runtime-uploaded files from public/ in production.
 *
 * The /uploads/* path is rewritten to /api/uploads/* in next.config.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";

// ─── MIME Types ─────────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

// ─── Security: Allowed Paths ────────────────────────────────────────────────────

// Only serve files from these subdirectories of public/uploads/
const ALLOWED_SUBDIRS = ["students"];

// ─── Route Handler ──────────────────────────────────────────────────────────────

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { path: pathSegments } = await params;

    // Validate path segments exist
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Security: Check first segment is an allowed subdirectory
    const subdir = pathSegments[0];
    if (!ALLOWED_SUBDIRS.includes(subdir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Security: Prevent path traversal attacks
    const safePath = pathSegments.join("/");
    if (safePath.includes("..") || safePath.includes("//")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Build full filesystem path
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const filePath = join(uploadsDir, ...pathSegments);

    // Security: Ensure resolved path is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check file exists
    if (!existsSync(filePath)) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Get file stats for caching headers
    const stats = await stat(filePath);

    // Read file
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Build response with caching headers
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.length),
        // Cache for 7 days (matches previous nginx config)
        "Cache-Control": "public, max-age=604800, immutable",
        // ETag for conditional requests
        "ETag": `"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`,
        // Last-Modified for conditional requests
        "Last-Modified": stats.mtime.toUTCString(),
        // Security headers
        "X-Content-Type-Options": "nosniff",
      },
    });

    return response;
  } catch (error) {
    console.error("Error serving upload:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
