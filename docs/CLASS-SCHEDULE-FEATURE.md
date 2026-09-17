# Class Schedule Feature - Implementation Plan

## Overview

Add a class scheduling feature where teachers and students can view schedules by subject per day/week, with conflict detection for sections, teachers, and rooms.

## Requirements Summary

- **Time structure:** Fixed period slots (e.g., Period 1: 7:30-8:30)
- **Days:** Monday to Friday
- **Pattern:** Same schedule every week (weekly template)
- **Rooms:** Track room assignments with conflict detection
- **Managers:** Admin, Coordinators, Principals (coordinators scoped to their grade levels)
- **Conflict detection:** Section, Teacher, Room
- **Views:** Day view (list) + Week grid (timetable)
- **Viewers:** Teachers (their classes), Students (enrolled classes)

## Architecture

**Approach:** Schedule Slots Linked to Subject Offerings

- `periods` table: Period templates per school year
- `rooms` table: Room/venue definitions
- `scheduleSlots` table: Links subjectOfferingId + day + periodId + roomId

Conflict detection enforced via unique partial indexes on the database.

---

## Database Schema

### New Tables (add to `src/lib/db/schema.ts`)

**1. `periods`**
```typescript
{
  id, schoolYearId, name, periodNumber, startTime, endTime,
  isClassPeriod, gradeGroup (nullable), isActive,
  createdAt/By, updatedAt/By, deletedAt/By
}
```
- Unique: (schoolYearId, periodNumber, gradeGroup) where deletedAt IS NULL
- Check: endTime > startTime

**2. `rooms`**
```typescript
{
  id, code, name, building, floor, capacity, roomType, isActive,
  createdAt/By, updatedAt/By, deletedAt/By
}
```
- Unique: code where deletedAt IS NULL

**3. `scheduleSlots`**
```typescript
{
  id, subjectOfferingId, dayOfWeek (enum), periodId, roomId,
  schoolYearId, teacherId, sectionId,  // denormalized for conflict queries
  createdAt/By, updatedAt/By, deletedAt/By
}
```
- `dayOfWeekEnum`: monday, tuesday, wednesday, thursday, friday

**Conflict Indexes (unique partial indexes):**
- Section: `(sectionId, dayOfWeek, periodId, schoolYearId)` WHERE deletedAt IS NULL
- Teacher: `(teacherId, dayOfWeek, periodId, schoolYearId)` WHERE teacherId IS NOT NULL AND deletedAt IS NULL
- Room: `(roomId, dayOfWeek, periodId, schoolYearId)` WHERE roomId IS NOT NULL AND deletedAt IS NULL

---

## Feature Structure

**Location:** `src/features/academics/schedules/`

```
schedules/
├── schedules.schema.ts       # Zod schemas + types
├── schedules.queries.ts      # Server queries
├── schedules.actions.ts      # Server actions
├── components/
│   ├── ScheduleGrid.tsx      # Week grid (Mon-Fri × Periods)
│   ├── DayScheduleList.tsx   # Today's classes list
│   ├── ScheduleSlotCard.tsx  # Slot display card
│   ├── ScheduleSlotForm.tsx  # Create/edit slot
│   ├── ConflictWarning.tsx   # Show conflicts
│   ├── PeriodManagement.tsx  # Admin period CRUD
│   ├── RoomManagement.tsx    # Admin room CRUD
│   └── index.ts
└── index.ts
```

---

## Routes

**Staff (Management):**
- `/staff/academics/schedules` — Overview, select section
- `/staff/academics/schedules/periods` — Period management (admin)
- `/staff/academics/schedules/rooms` — Room management (admin)
- `/staff/academics/schedules/sections/[sectionId]` — Section schedule grid

**Portal (Student View):**
- `/portal/schedule` — Student's class schedule

**Teacher View:**
- Integrate with existing teacher dashboard (`/staff/grades`)

---

## Permissions

Add to `src/lib/rbac/permissions.ts`:

| Permission | Roles |
|------------|-------|
| `schedules:read` | All staff + student |
| `schedules:manage` | admin, coordinator, principal |
| `schedules:manage_periods` | admin, coordinator, principal |
| `schedules:manage_rooms` | admin, coordinator, principal |

Coordinators scoped to their assigned grade group. Principals have full schedule management access.

---

## Key Queries

1. `getPeriodsForSchoolYear(schoolYearId, gradeGroup?)` — Period templates
2. `getActiveRooms()` — Available rooms
3. `getScheduleForSection(sectionId, schoolYearId)` — Weekly grid data
4. `getScheduleForTeacher(teacherId, schoolYearId)` — Teacher's classes
5. `getScheduleForStudent(studentId, schoolYearId)` — Via studentSubjectEnrollments
6. `getTodayScheduleForSection(sectionId, schoolYearId)` — Day view
7. `getAvailablePeriodsForOffering(subjectOfferingId)` — Unscheduled slots

---

## Key Actions

1. `createPeriodAction` / `updatePeriodAction` / `deletePeriodAction`
2. `createRoomAction` / `updateRoomAction` / `deleteRoomAction`
3. `createScheduleSlotAction` — With conflict detection
4. `updateScheduleSlotAction` — With conflict detection
5. `deleteScheduleSlotAction`
6. `bulkCreateSlotsAction` — Batch creation

**Conflict Detection Flow:**
1. Before insert/update, query for existing slots with same (day, period, schoolYear) and matching (section OR teacher OR room)
2. Return conflict info to UI
3. Block creation if conflicts exist

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Add schema tables + enum to `schema.ts`
- [ ] Generate migration: `npm run db:generate -- --name=add_class_schedule_tables`
- [ ] Apply migration: `npm run db:migrate`
- [ ] Add `SCHEDULES` to cache tags
- [ ] Create feature folder structure
- [ ] Implement `schedules.schema.ts`

### Phase 2: Period & Room Management
- [ ] Implement period queries
- [ ] Implement period actions
- [ ] Implement room queries
- [ ] Implement room actions
- [ ] Create PeriodManagement page
- [ ] Create RoomManagement page

### Phase 3: Schedule Slot Core
- [ ] Implement schedule slot queries
- [ ] Implement conflict detection function
- [ ] Implement schedule slot actions
- [ ] Create ScheduleGrid component
- [ ] Create ScheduleSlotCard component
- [ ] Create ScheduleSlotForm component
- [ ] Create ConflictWarning component
- [ ] Create section schedule page

### Phase 4: Views
- [ ] Create DayScheduleList component
- [ ] Create student portal schedule page
- [ ] Add teacher schedule view integration
- [ ] Add schedule link to section detail page

### Phase 5: Polish
- [ ] Mobile-responsive grid
- [ ] Export/print functionality
- [ ] Bulk operations UI

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add periods, rooms, scheduleSlots tables + relations |
| `src/lib/rbac/permissions.ts` | Add schedule permissions |
| `src/lib/cache/cache-tags.ts` | Add SCHEDULES tag |

---

## Verification

1. **Build:** `npm run build` — No TypeScript errors
2. **Lint:** `npm run lint` — No lint errors
3. **Migration:** Verify tables created in database
4. **Manual Testing:**
   - Create periods for a school year
   - Create rooms
   - Assign schedule slots to a section
   - Verify conflict detection blocks duplicate booking
   - View schedule as teacher
   - View schedule as student
5. **E2E (optional):** Add test for schedule creation with conflict

---

## Notes

- Teacher ID in scheduleSlots is denormalized from subjectOfferings for query performance
- If teacher assignment changes on subjectOffering, need to update scheduleSlots
- Period times are stored as "HH:mm" strings for simplicity (no timezone handling needed)
- Soft delete only — no hard deletes
