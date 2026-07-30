# SRAMS Performance Audit Prompt

Act as a Principal Software Architect conducting a production-grade architecture review of the School Registration and Account Monitoring System (SRAMS).

The project uses:

- Next.js App Router
- TypeScript
- PostgreSQL
- Drizzle ORM
- TanStack Query
- TanStack Form
- Shadcn UI
- TailwindCSS
- Zod

Your objectives are to improve:

1. Database Performance
2. Query Performance
3. Backend Architecture
4. React Performance
5. Code Quality
6. Modularity
7. Reusability
8. Maintainability
9. Scalability
10. Security

---

## Audit Process

For every file inspected:

1. Explain its purpose.
2. Identify performance bottlenecks.
3. Identify architectural issues.
4. Identify duplicated logic.
5. Recommend reusable abstractions.
6. Recommend refactoring steps.
7. Estimate performance impact.
8. Assess implementation risk.
9. Preserve backward compatibility unless explicitly approved.

Do not provide generic advice. Base all recommendations on the actual codebase.

---

## Required Reports

Produce the following reports:

### 1. Executive Summary

- Overall architecture health
- Key strengths
- Key weaknesses
- Top priorities

### 2. Database Review

- Schema quality
- Normalization
- Indexes
- Constraints
- Migration history
- Query plan concerns

### 3. Query Optimization

- Slow queries
- N+1 issues
- Redundant joins
- Pagination
- Transaction usage
- Optimized SQL/Drizzle examples

### 4. Backend Review

- Server Actions
- Repository layer
- Service layer
- Validation
- Authorization
- Error handling

### 5. Frontend Review

- React rendering
- TanStack Query usage
- TanStack Form usage
- Bundle size
- Caching
- Server vs Client Components

### 6. UI/CSS Review

- Duplicate components
- Shared component opportunities
- Tailwind optimization
- Design consistency

### 7. Refactoring Roadmap

Provide phased implementation:

- Phase 1: Critical performance fixes
- Phase 2: Database optimization
- Phase 3: Backend modularization
- Phase 4: Frontend optimization
- Phase 5: UI consolidation
- Phase 6: Technical debt cleanup

For each phase include:

- Objectives
- Files affected
- Risks
- Dependencies
- Estimated effort
- Expected performance gains

### 8. Final Scorecard

Rate the system on:

- Database Performance
- Query Efficiency
- Backend Design
- Frontend Performance
- UI Consistency
- Code Reusability
- Maintainability
- Scalability
- Security
- Overall Architecture

Provide a prioritized action list that maximizes performance improvements while minimizing disruption to production.
