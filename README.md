# SRAMS - School Registration and Accounts Monitoring System

<p align="center">
  <strong>A production-grade K-12 school management system for Philippine private schools</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#user-roles">User Roles</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

**SRAMS** is a comprehensive school management system built for K-12 private schools (Casa through Grade 12). It handles the complete student lifecycle—from registration and enrollment to fee assessment, payment processing with Official Receipt (OR) tracking, and academic grade encoding.

Designed for operational efficiency at schools with 700-1000 students, SRAMS emphasizes:

- **Financial Controls** — Official Receipt booklet management with full audit trails
- **Workflow Automation** — Multi-step approval processes for payments, grades, and discounts
- **Role-Based Access** — 9 distinct roles with granular permissions
- **Production Readiness** — Docker deployment, rate limiting, session security

---

## Features

### Student & Enrollment Management

- **Student Lifecycle** — Track students from registration through graduation/transfer/withdrawal
- **Registration Queue** — Formal intake process with document tracking (Form 138, birth certificate, etc.)
- **4-Step Enrollment** — Pending → Assessed → Enrolled with cancellation support
- **Parent/Guardian Links** — Many-to-many relationships with primary contact designation
- **Photo Management** — Student photo upload and display
- **Batch Archival** — End-of-year processing for graduates and transfers

### Fee Assessment & Payments

- **Fee Schedules** — Per school year and assessment band (Casa, Elementary, JHS, SHS)
- **Fee Templates** — Reusable templates for consistent fee structures
- **OR Booklet Management** — Define booklets with prefix and number ranges (e.g., AP 00001-00050)
- **Payment Posting** — Auto-assign sequential OR numbers from active booklets
- **Payment Methods** — Cash, GCash, and bank transfer support
- **Void Requests** — Approval-based workflow with reversal accounting
- **Balance Forward** — Carry unpaid balances to new school year

### Academic Management

- **Curriculum Versioning** — Draft → Published → Archived with cloning
- **Subject Management** — Core and elective subjects with SHS strand support (STEM, ABM, HUMSS, GAS, TVL)
- **Section Management** — Class sections per grade level and school year
- **Grade Encoding** — Adviser-based grade sheet workflow
- **Grade Approval** — Coordinator review → Principal approval → Portal publication
- **Grading Periods** — Quarterly (Q1-Q4) or trimester (T1-T3) support

### Discounts & Financial Aid

- **Discount Types** — ESC grant, sibling, academic, staff, and manual discounts
- **Approval Workflow** — Request → Review → Approve/Reject
- **Assessment Gating** — Block payment posting until discounts resolved
- **Reversal Support** — Incorrect discounts reversed with audit trail

### Document Requests & Archival

- **Archive Directory** — Manage former students (graduated, transferred, withdrawn)
- **Document Types** — Form 137, Form 138, Good Moral, Certificates, Diplomas
- **Request Workflow** — Requested → Processing → Ready → Released
- **Balance Gates** — Require clearance before document release
- **PDF Generation** — Official documents with proper formatting

### Reports & Analytics

- **Payment Collection** — Daily/weekly/monthly reports by payment method
- **Accounts Receivable** — Outstanding balances by student/grade/section
- **Balance Forward** — Track transferred balances across school years
- **Export Formats** — PDF for official documents, Excel for analytics

### Portal Access

- **Student Portal** — View assessments, payments, and grades
- **Parent Portal** — Monitor child's academic and financial records

---

## Tech Stack

| Category           | Technology                               |
| ------------------ | ---------------------------------------- |
| **Framework**      | Next.js 16 (App Router)                  |
| **Frontend**       | React 19, Tailwind CSS 4, shadcn/ui      |
| **Forms**          | React 19 `useActionState`, TanStack Form |
| **Tables**         | TanStack Table, TanStack Query           |
| **Database**       | PostgreSQL, Drizzle ORM                  |
| **Authentication** | JWT (jose library)                       |
| **PDF Generation** | @react-pdf/renderer                      |
| **Excel Export**   | ExcelJS                                  |
| **Testing**        | Vitest (unit), Playwright (E2E)          |
| **Deployment**     | Docker, Nginx                            |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or pnpm

## User Roles

| Role                | Description          | Key Permissions                                 |
| ------------------- | -------------------- | ----------------------------------------------- |
| **Super Admin**     | System configuration | Full access to all features                     |
| **Admin**           | Operations oversight | All business operations, void approvals         |
| **Registrar**       | Student records      | Enrollments, registrations, assessments         |
| **Finance Officer** | Financial management | Fee schedules, OR booklets, discounts, invoices |
| **Cashier**         | Payment processing   | Post payments, request voids                    |
| **Teacher**         | Grade encoding       | Enter grades for assigned subjects              |
| **Coordinator**     | Academic oversight   | Review grade sheets, manage sections            |
| **Principal**       | Final approvals      | Approve grades, publish to portal               |
| **Student/Parent**  | Portal access        | View own records                                |

---

## Key Workflows

### Enrollment Process

```
Registration → Approval → Enrollment (Pending)
    ↓
Assessment Created (fees from schedule)
    ↓
Discount Review (if applicable)
    ↓
Assessment Finalized (Assessed)
    ↓
First Payment Posted → Status: Enrolled
```

### Payment with OR Tracking

```
Finance Officer Creates OR Booklet (e.g., AP 00001-00050)
    ↓
Cashier Selects Active Booklet
    ↓
System Auto-Assigns Next OR Number
    ↓
Payment Posted → OR Marked Consumed (immutable)
    ↓
Ledger Entry Created with Running Balance
```

### Grade Encoding (Adviser Workflow)

```
Section Adviser Enters Grades (all subjects, all students)
    ↓
Submits Grade Sheet for Review
    ↓
Coordinator Reviews
    ↓
Principal Approves → Grades Published to Portal
```

---

## Architecture

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── staff/              # Internal operations portal
│   ├── portal/             # Student/parent portal
│   └── admin/              # Admin configuration
├── features/               # Feature-based modules
│   ├── students/
│   ├── enrollments/
│   ├── assessments/
│   ├── payments/
│   ├── academics/
│   └── ...
├── lib/
│   ├── db/                 # Database schema & migrations
│   ├── auth/               # JWT session management
│   ├── rbac/               # Role-based access control
│   └── utils/              # Utilities
└── components/
    ├── shared/             # Reusable UI components
    └── forms/              # Form components
```

### Design Principles

- **Server Actions for Mutations** — All database writes through `"use server"` actions
- **Soft Delete Only** — All records use `deletedAt`/`deletedBy` fields
- **3-Level RBAC** — Route guard → Action validation → Audit logging
- **Financial Audit Trail** — Every payment, void, and discount logged
- **OR Immutability** — Once consumed, OR numbers cannot be reused

---

## Deployment

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Production Checklist

- [ ] Set `AUTH_SECRET` to a secure 32+ character string
- [ ] Configure `DATABASE_URL` for production PostgreSQL
- [ ] Set `SESSION_COOKIE_SECURE=true` if using HTTPS
- [ ] Configure Nginx with appropriate body size limits (5MB for uploads)
- [ ] Set up database backups

---

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

---

## License

This project is proprietary software. All rights reserved.

---

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database ORM by [Drizzle](https://orm.drizzle.team/)

---

<p align="center">
  Made with care for Philippine K-12 schools
</p>
