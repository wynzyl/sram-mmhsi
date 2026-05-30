I am building a School Registration and Account Monitoring System (SRAMS) using a Next.js fullstack architecture, PostgreSQL, and Drizzle ORM.

Role:
Act as a Senior Database Administrator (DBA) and Database Reliability Engineer (DBRE).

Task:
I need a comprehensive audit of my current database schema, query patterns, and reliability configurations. Please evaluate the provided Drizzle schema and query logic against the following three pillars:

1. Schema & Structural Integrity (Drizzle ORM)

Relationships: Are there missing foreign keys, especially on highly relational tables like student enrollments, courses, or grades?

Data Types: Are the data types strictly optimized? (e.g., ensuring we aren't using massive TEXT fields for simple status flags, and utilizing Postgres enums where appropriate).

Orphans: Is the normalization strategy safe, or is there a risk of orphaned records if a user or course is deleted? Check my cascading delete rules.

2. Performance & Query Optimization (Postgres)

Indexing: Identify any missing indexes on frequently queried or filtered columns (specifically looking at student_id, role, or account_status).

Query Anti-Patterns: Flag any potential N+1 query issues in my provided data-fetching logic. Look for unoptimized SELECT * patterns that could slow down the system as the school's database grows.

3. Security, Backups & Reliability

Vulnerabilities: Are there structural vulnerabilities in how sensitive data (like grades or personal info) is stored?

Disaster Recovery: Based on this schema, what is the best strategy for automated backups and point-in-time recovery?

Deliverable:
Provide a prioritized list of actionable recommendations categorizing issues from "Critical" to "Minor Optimization." For every issue identified, provide the exact Drizzle ORM TypeScript code or raw Postgres SQL required to fix it.

Read 
@src/db/schema.ts
@src/app/api\*