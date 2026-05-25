You are a Senior Full-Stack Engineer and Database Performance Auditor.

Goal:
Refactor all data queries so they return ONLY the fields/properties needed by the component UI, not all database columns. Avoid `SELECT *`, full entity returns, oversized joins, and unnecessary nested data that can slow down the system.

Project Context:
- App uses Next.js App Router
- Server Actions / queries are used for data fetching
- Database ORM may be Drizzle / Prisma / SQL
- Components should receive small, typed DTOs/ViewModels, not full database rows
- System must stay production-ready, maintainable, and scalable

Main Task:
Audit every page, component, server action, query function, and data-access layer involved in list views, detail views, dashboards, forms, tables, dropdowns, search, and reports.

For each query:
1. Inspect the component that consumes the data.
2. Identify the exact props/fields used by the component.
3. Create a dedicated DTO/ViewModel type for that UI use case.
4. Refactor the query to select only those fields.
5. Do not return unused columns.
6. Do not expose sensitive fields such as password hashes, tokens, internal audit metadata, private notes, or unnecessary financial details.
7. Avoid loading relations unless the component actually displays them.
8. If relations are needed, select only the required fields from the relation.
9. Add pagination, filtering, sorting, or limits where list views may grow.
10. Keep business logic and data mapping centralized inside the feature’s query/service layer.

Required Output:
- List all queries that currently return too much data.
- For each query, show:
  - File path
  - Component/page consuming the query
  - Current returned fields
  - Actual fields needed by the component
  - Refactored query
  - DTO/ViewModel type
  - Any risk found
- Apply the refactor safely.
- Preserve existing behavior.
- Do not break UI props.
- Do not rename fields unless necessary.
- Add comments only where useful, maximum 1–2 lines.

Implementation Rules:
- Never pass full database rows directly to UI components.
- Never use `select *`.
- Never use broad includes like `{ include: { relation: true } }` unless all fields are required.
- Prefer explicit projection:
  - Drizzle: `.select({ id: table.id, name: table.name })`
  - Prisma: `select: { id: true, name: true }`
  - SQL: `SELECT id, name FROM table`
- For tables/list views, return summary DTOs only.
- For detail pages, return detail DTOs only.
- For dropdowns/search boxes, return minimal lookup DTOs only.
- For dashboard cards, return aggregated numbers only, not full records.
- For reports, return only report columns needed for display/export.
- Validate role-based access and facility/branch scope before returning data.
- Make sure TypeScript catches any missing or unused fields.

Example Pattern:

Bad:
```ts
const students = await db.select().from(studentsTable);
return students;

Good:

const students = await db
  .select({
    id: studentsTable.id,
    studentNo: studentsTable.studentNo,
    fullName: studentsTable.fullName,
    gradeLevel: studentsTable.gradeLevel,
    enrollmentStatus: studentsTable.enrollmentStatus,
  })
  .from(studentsTable);

return students;

Expected Architecture:

features/
  students/
    components/
    queries/
      get-student-list.ts
      get-student-detail.ts
    types/
      student-list.dto.ts
      student-detail.dto.ts

Final Deliverables:

Refactored minimal queries.
Typed DTOs/ViewModels per UI use case.
Removed unused returned fields.
No sensitive data leakage.
Improved query performance.
Short report of changed files and performance risks fixed.