Platform Architecture
Overview
CFMS is an enterprise Complaints & Feedback Management Platform designed to be secure, reliable, maintainable, and extensible.
The platform follows a modular layered architecture:
Frontend
   ↓
API / Routes
   ↓
Middleware
   ↓
Controllers
   ↓
Services
   ↓
Prisma
   ↓
PostgreSQL
Technology Stack
•	Backend: Node.js, Express, TypeScript, Prisma 
•	Database: PostgreSQL 
•	Frontend: React, TypeScript, Vite 
•	UI: Tailwind CSS, shadcn/ui, Radix UI 
•	Validation: Zod 
•	Testing: Jest 
Prisma is the authoritative ORM for active runtime code. Existing Sequelize artifacts may remain where they are historical or required for migration compatibility.
Organizational Architecture
CFMS uses a single hierarchical organizations model.
Organizational structures such as Organization, Country Office, Branch, Sector, Department, Office, and Team are represented as organizational nodes rather than separate database tables.
organizations
├── id
├── name
├── parent_id
├── parent_path
└── org_unit_type_id
          ↓
    org_unit_types
The hierarchy supports:
•	Parent/child relationships 
•	Multiple root organizations 
•	Configurable organizational unit types 
•	Organizational membership 
•	Organizational context 
The backend must maintain hierarchy integrity and prevent invalid or cyclic relationships.
Existing org_units structures must be inspected before any migration, consolidation, or removal.
Users and Organizations
Users have a default organization through:
users.organization_id
A user may also belong to multiple organizations through:
user_organizations
This allows one user account to operate across multiple organizational contexts.
Organizational membership determines context; it does not by itself determine permissions.
Authorization
CFMS uses Role-Based Access Control (RBAC):
User
  ↓
Role
  ↓
Permission
Organizational context and authorization are separate concerns.
The existing RBAC implementation must be reused and preserved unless a clear architectural requirement requires change.
Groups are not part of the target authorization model.
Security
Security is enforced server-side.
The frontend must never be trusted to determine:
•	User identity 
•	Organizational access 
•	Permissions 
•	Organizational scope 
•	Resource ownership 
Protected operations must validate authentication, authorization, organizational context, and applicable business rules.
Public endpoints must validate their organizational context on the server.
Core Platform and Business Modules
CFMS is divided into Core Platform capabilities and Business Modules.
Core Platform
Provides shared capabilities such as:
•	Organizations 
•	Users 
•	Authentication 
•	RBAC 
•	Reference Data 
•	Audit 
•	Notifications 
•	File Management 
Business Modules
Provide domain-specific functionality such as:
•	Complaints & Feedback 
•	Workflow 
•	Dashboard/Reporting Engine
•	SLA 
•	Escalation 
•	Assignment 
•	Reporting 
Business modules should reuse Core Platform services rather than duplicate foundational functionality.
Application Layers
Routes
Define API endpoints and compose middleware.
Middleware
Handles cross-cutting concerns such as authentication, authorization, validation, and organizational context.
Controllers
Handle HTTP requests and responses and delegate business logic to services.
Services
Contain business rules, application logic, authorization-related checks, organizational rules, and transactional operations.
Prisma
Provides type-safe database access and transaction management.
PostgreSQL
Provides persistent storage and relational data integrity.
Business logic should not be duplicated between controllers and frontend code.
Data Architecture
PostgreSQL is the authoritative database.
Database integrity should be protected through appropriate:
•	Foreign keys 
•	Unique constraints 
•	Indexes 
•	Database constraints 
•	Transactions 
Database operations that must succeed or fail together should use transactions.
API Architecture
APIs should be:
•	Consistent 
•	Validated 
•	Authenticated where required 
•	Authorized server-side 
•	Properly scoped 
•	Explicit in their error handling 
Input validation should occur at the API boundary using Zod or equivalent validation.
API contracts should remain stable and backward-compatible where practical.
Frontend Architecture
The frontend uses React and TypeScript with Vite, Tailwind CSS, shadcn/ui, Radix UI, and React Router.
The frontend should be:
•	Responsive 
•	Accessible 
•	Consistent 
•	Component-based 
•	Reusable 
•	Suitable for desktop and mobile 
The frontend provides the user experience and must never be treated as a security boundary.
Reliability and Maintainability
The architecture prioritizes:
•	Strong typing 
•	Clear separation of responsibilities 
•	Centralized business logic 
•	Transactional operations 
•	Consistent error handling 
•	Structured logging 
•	Auditability 
•	Automated testing 
•	Safe database migrations 
•	Backward compatibility 
•	Low coupling between modules 
Existing functionality must not be removed or redesigned without first verifying its actual usage and dependencies.
Testing
Testing should cover:
•	Business logic 
•	Services 
•	APIs 
•	Database interactions 
•	Authorization 
•	Organizational access 
•	Critical user workflows 
Tests must use isolated environments and must never operate against production data.
Architecture Evolution
Significant architectural changes should follow:
Inspect
  ↓
Understand
  ↓
Define Target
  ↓
Plan
  ↓
Implement
  ↓
Test
  ↓
Verify
  ↓
Document
Applied migrations and production data must not be modified to hide inconsistencies.
Destructive database operations require explicit authorization.
Architectural Principle
Organizations define structure.
Membership defines organizational context.
Roles and permissions define authority.
Services enforce business rules.
Prisma provides data access.
Business modules provide domain functionality.
The frontend provides user experience, not security.
CFMS architecture must remain secure, reliable, maintainable, testable, and extensible as the platform evolves.

