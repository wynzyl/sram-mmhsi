## ROLES FOR USERS

1. Super_Admin -  Manages system setup, users, roles, database-related settings.
2. Admin -  Can view and access all business operations and reports. 
3. registrar — Student records & enrollment management and Allow Cashier ROLE
4. finance_officer — Fee schedules, assessments, invoices, OR booklet setup
5. cashier — Payment posting only
6. teacher — Grade encoding only
7. student — View own assessments, payments, grades


# SKILL.md — Authentication, Authorization, Roles, Grants, and Page Access Control

## Purpose

This skill defines the authentication and authorization rules for the School Registration and Account Monitoring System.

Claude Code must use this skill when implementing:

- User login and session handling
- Role-based access control
- Permission grants
- Page access restrictions
- API/server action authorization
- Sidebar/menu visibility
- Student self-service access
- Audit-safe operational workflows

The system must use **centralized RBAC**. Do not duplicate pages per role. One feature page should be reused across roles, with access controlled by permissions.

---

# 1. Core Authorization Principle

Use this rule everywhere:

> **Deny by default. Grant only explicit permissions.**

A user may access a page or perform an action only when:

1. The user is authenticated.
2. The account is active.
3. The user has a valid role.
4. The role has the required permission.
5. For scoped data, the user owns the resource or is assigned to it.

Never rely only on hidden buttons or sidebar menu filtering. Every protected page, server action, API route, and mutation must enforce permission checks.

---

# 2. User Roles

The system has the following roles:

| Role | Description |
|---|---|
| `super_admin` | Manages system setup, users, roles, permissions, database-related settings, and full system configuration. |
| `admin` | Can access business operations and reports. Cannot manage low-level system/database/security settings unless explicitly granted. |
| `registrar` | Manages student records, registration, enrollment, and academic records workflow. Allow Cashier ROLE |
| `finance_officer` | Manages fee schedules, assessments, invoices, OR booklet setup, and finance monitoring. |
| `cashier` | Posts payments only. Limited access to payment collection screens and assigned payment history. |
| `teacher` | Encodes grades only for assigned classes, sections, subjects, or advisory load. |
| `student` | Views own assessments, payments, balances, invoices, and grades only. |

Use lowercase role keys in code.

---

# 3. Permission Naming Convention

Use permission strings in this format:

```txt
module.action