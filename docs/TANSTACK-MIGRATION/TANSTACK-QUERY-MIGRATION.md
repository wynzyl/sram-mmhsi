# TanStack Query Implementation Plan for SRAMS

## Overview

Integrate TanStack Query v5 into the SRAMS project to enable client-side server-state management, caching, and data synchronization following the architecture:

```
Client Component → TanStack Query → API Route → Drizzle ORM → Database
```

## Current State

- **No TanStack Query** - Server-first architecture with data passed as props
- **TanStack Table** already installed (`@tanstack/react-table` ^8.21.3)
- **Provider setup**: Only `ThemeProvider` in `RootProviders.tsx`
- **Mutations**: `useActionState` + server actions with `revalidatePath()`

---

## Phase 1: Foundation Setup

### 1.1 Install Dependencies

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 1.2 Create Query Client Factory

**Create `src/lib/query/query-client.ts`:**
```typescript
import { isServer, QueryClient } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,      // 1 minute
        gcTime: 5 * 60 * 1000,     // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
```

### 1.3 Create Query Keys Factory

**Create `src/lib/query/keys.ts`:**
```typescript
export const queryKeys = {
  students: {
    all: ['students'] as const,
    lists: () => [...queryKeys.students.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.students.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.students.all, 'detail', id] as const,
  },
  assessments: {
    all: ['assessments'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.assessments.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.assessments.all, 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    queue: () => [...queryKeys.payments.all, 'queue'] as const,
  },
  booklets: {
    all: ['booklets'] as const,
    active: () => [...queryKeys.booklets.all, 'active'] as const,
    list: () => [...queryKeys.booklets.all, 'list'] as const,
  },
  feeItemTypes: {
    all: ['feeItemTypes'] as const,
    list: () => [...queryKeys.feeItemTypes.all, 'list'] as const,
  },
  schoolYears: {
    all: ['schoolYears'] as const,
    list: () => [...queryKeys.schoolYears.all, 'list'] as const,
    active: () => [...queryKeys.schoolYears.all, 'active'] as const,
  },
  gradeLevels: {
    all: ['gradeLevels'] as const,
    list: () => [...queryKeys.gradeLevels.all, 'list'] as const,
  },
}
```

### 1.4 Create Query Provider

**Create `src/components/providers/QueryProvider.tsx`:**
```typescript
'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '@/lib/query/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### 1.5 Update RootProviders

**Modify `src/components/providers/RootProviders.tsx`:**
```typescript
'use client'
import { ThemeProvider } from './ThemeProvider'
import { QueryProvider } from './QueryProvider'

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryProvider>
  )
}
```

---

## Phase 2: Pilot Feature - Fee Item Types

Low-risk, simple CRUD feature for validation.

### 2.1 Create API Route

**Create `src/app/api/fee-item-types/route.ts`:**
- GET handler returning all fee item types
- Auth check with `requireSession()`
- Permission check with `hasPermission()`

### 2.2 Create Custom Hook

**Create `src/features/finance/fee-item-types/hooks/use-fee-item-types.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'

export function useFeeItemTypes() {
  return useQuery({
    queryKey: queryKeys.feeItemTypes.list(),
    queryFn: async () => {
      const res = await fetch('/api/fee-item-types')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })
}
```

### 2.3 Update Component

Migrate `FeeItemTypesTable` to use `useFeeItemTypes()` hook instead of props.

---

## Phase 3: Student Directory Migration

### 3.1 Create API Route

**Create `src/app/api/students/route.ts`:**
- Wraps existing `fetchStudentDirectoryPage()` query
- Accepts query params: `q`, `page`, `schoolYearId`, `gradeLevelId`

### 3.2 Create Custom Hook

**Create `src/features/students/hooks/use-students.ts`:**
```typescript
export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: queryKeys.students.list(filters),
    queryFn: async () => { /* fetch from API */ },
    placeholderData: (prev) => prev,
  })
}
```

### 3.3 Add SSR Hydration

**Update `src/app/page-templates/students/students-directory-page.tsx`:**
```typescript
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query/query-client'

// Prefetch on server
await queryClient.prefetchQuery({
  queryKey: queryKeys.students.list(filters),
  queryFn: () => fetchStudentDirectoryPage(filters),
})

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <StudentDirectoryView initialFilters={filters} />
  </HydrationBoundary>
)
```

---

## Phase 4: Cashier Queue (High Value)

### 4.1 Create API Route

**Create `src/app/api/cashier/queue/route.ts`**

### 4.2 Create Hook with Auto-Refresh

```typescript
export function useCashierQueue() {
  return useQuery({
    queryKey: queryKeys.payments.queue(),
    queryFn: fetchCashierQueue,
    refetchInterval: 30000, // 30 seconds
  })
}
```

### 4.3 Create Payment Mutation

```typescript
export function usePostPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: postPaymentAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.queue() })
      queryClient.invalidateQueries({ queryKey: queryKeys.booklets.active() })
    },
  })
}
```

---

## Phase 5: QueryDataTable Component

**Create `src/components/shared/QueryDataTable.tsx`:**

A wrapper around existing `DataTable` that accepts query configuration instead of data props.

```typescript
interface QueryDataTableProps<TData> {
  queryKey: QueryKey
  queryFn: () => Promise<{ data: TData[]; pagination?: PaginationMeta }>
  columns: ColumnDef<TData>[]
  // ... other DataTable props
}
```

---

## Critical Files

| File | Action |
|------|--------|
| `src/components/providers/RootProviders.tsx` | Modify - Add QueryProvider |
| `src/lib/query/query-client.ts` | Create |
| `src/lib/query/keys.ts` | Create |
| `src/components/providers/QueryProvider.tsx` | Create |
| `src/app/api/fee-item-types/route.ts` | Create |
| `src/app/api/students/route.ts` | Create |
| `src/app/api/cashier/queue/route.ts` | Create |
| `src/features/*/hooks/use-*.ts` | Create (per feature) |
| `src/components/shared/QueryDataTable.tsx` | Create |

---

## Invalidation Strategy

### After Mutations (in useMutation hooks)
```typescript
// After payment
queryClient.invalidateQueries({ queryKey: queryKeys.payments.queue() })
queryClient.invalidateQueries({ queryKey: queryKeys.assessments.detail(id) })

// After student create
queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() })
```

### Keep revalidatePath in Server Actions
Server actions should continue calling `revalidatePath()` as a fallback to ensure Next.js cache is also invalidated.

---

## Migration Order

| Order | Feature | Risk | Notes |
|-------|---------|------|-------|
| 1 | Foundation setup | Low | Provider + keys + client |
| 2 | Fee Item Types | Low | Simple CRUD pilot |
| 3 | Booklets List | Low | Admin feature |
| 4 | Student Directory | Medium | SSR hydration |
| 5 | Cashier Queue | Medium | High value, auto-refresh |
| 6 | Assessments | Medium | Complex relationships |

---

## Verification

### Phase 1 Verification
1. Run `npm run build` - should compile without errors
2. Start dev server, open React Query Devtools (bottom-left icon)
3. Verify no console errors about QueryClient

### Phase 2 Verification (Fee Item Types)
1. Navigate to `/staff/finance/fee-item-types`
2. Check React Query Devtools shows `['feeItemTypes', 'list']` query
3. Verify data loads correctly
4. Test create/toggle actions invalidate cache

### Phase 3 Verification (Students)
1. Navigate to `/staff/students`
2. Verify instant load (SSR hydration)
3. Change filters - verify background refetch
4. Check React Query Devtools for query state

### Phase 4 Verification (Cashier)
1. Navigate to `/staff/cashier/queue`
2. Wait 30 seconds - verify auto-refetch
3. Post a payment - verify queue updates
4. Check devtools for invalidation

### E2E Test
```bash
npm run test:e2e
```
