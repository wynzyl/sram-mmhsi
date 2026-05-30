Role: You are an expert Full-Stack Security Engineer specializing in Next.js (App Router), PostgreSQL, and Drizzle ORM.

Task: I need a comprehensive audit of the authentication and session management layer for my School Registration and Account Monitoring System (SRAMS). We recently migrated to a pure Next.js fullstack approach to resolve infinite redirect loops and Role-Based Access Control (RBAC) failures. 

Please review my provided routing, middleware, and session logic against the following security and architectural checklists:

1. Middleware and Routing Validation
- Check my *`proxy.ts`(nextjs convention) to ensure public routes (like `/login` and `/register`) are explicitly bypassed.
- Verify that protected routes correctly intercept unauthenticated users without triggering infinite redirect loops.
- Confirm that API routes and Server Actions have redundant session validation, preventing unauthorized direct endpoint access.

2. Session Payload and Persistence
- Audit how the session is created upon successful login. Is the `userId` and `role` (Admin, Student, Teacher) properly serialized?
- Verify the cookie configuration. Are the session cookies strictly set to `HttpOnly`, `Secure` (in production), and `SameSite=Lax` or `Strict`?
- Review my session persistence strategy. If using a database table via Drizzle ORM, check the schema for proper indexing on session tokens and expiration timestamps.

3. Role-Based Access Control (RBAC) Execution
- Analyze the RBAC utility functions. Do they correctly read the role from the validated session payload?
- Ensure that if a session exists but the role is invalid or insufficient, the system gracefully throws a 403 Forbidden error rather than crashing or redirecting to login.

4. Vulnerability Check
- Scan for common pitfalls: missing CSRF protection on mutation endpoints, improper password hashing mechanisms, and potential session fixation vulnerabilities.

Output: Provide a prioritized list of vulnerabilities, configuration errors, and architectural bottlenecks found in the code. For every issue identified, provide the corrected Next.js/Drizzle code snippet to fix it.