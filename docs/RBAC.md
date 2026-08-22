# RBAC — Roles & Permissions

## Overview

CFMS uses Role-Based Access Control (RBAC) to control what users are allowed to do within their organizational context.

The authorization model separates:

- **Users** — user identities
- **Organizations** — organizational context
- **Roles** — collections of permissions
- **Permissions** — individual capabilities

```text
User
  ↓
Organizational Membership
  ↓
Role
  ↓
Permissions
Organizational structure and authorization are separate concerns.
The organization determines where a user operates, while roles and permissions determine what the user can do.
________________________________________
Permissions
permissions is the platform-wide permission catalog.
Each permission represents a specific capability, for example:
users.view
users.create
users.update
users.delete
complaints.view
complaints.create
complaints.assign
complaints.close
Permissions are not owned by an organization.
Roles reference permissions through:
role_permissions
________________________________________
Roles
Roles are reusable collections of permissions.
Examples include:
•	Administrator 
•	Manager 
•	Complaint Officer 
•	Reviewer 
•	Auditor 
•	Reporting User 
Roles can be reused across different organizational contexts.
The organizational context in which a role applies to a user is determined by the user's role assignment.
Where supported by the current data model, roles.organization_id may identify an organization-specific role definition. This does not replace the user's organizational membership or context.
Role
  ↓
Role Permissions
  ↓
Permissions
________________________________________
User Roles
A user's authority is determined through role assignments.
The primary assignment table is:
user_roles
A user may have different roles in different organizational contexts.
Example:
User
├── Organization A → Manager
└── Organization B → Complaint Officer
Where applicable, org_unit_id may further restrict the role to a specific organizational unit.
________________________________________
Organizational Context
Users have a default organization through:
users.organization_id
Users may also belong to multiple organizations through:
user_organizations
This allows one user account to operate across multiple organizational contexts.
Example:
User
├── Organization A
│      └── Role
│           └── Permissions
│
└── Organization B
       └── Role
            └── Permissions
Organizational membership does not automatically grant permissions.
The backend must evaluate the user's permissions within the applicable organizational context.
The frontend must never be trusted to determine or bypass organizational access.
________________________________________
Effective Permissions
The backend calculates the effective permissions available to a user.
The primary implementation is handled by:
services/rbacService.ts
Effective permissions may include the applicable organizational and organizational-unit context.
Conceptually:
{
  code,
  organizationId,
  orgUnitId
}
This ensures that a permission granted to a user in one organizational context is not automatically treated as permission in another context.
________________________________________
Authorization
Protected API operations must enforce authorization server-side.
The preferred mechanism for new endpoints is:
authorizePermission(...)
Authorization should verify:
1.	The user is authenticated. 
2.	The required permission is assigned to the user. 
3.	The permission applies to the current organizational context. 
4.	Organizational-unit scope is respected where applicable. 
5.	Additional business rules are satisfied. 
The existing authorize(...) mechanism may remain for backward compatibility.
New endpoints should prefer permission-based authorization.
________________________________________
Role Assignment Rules
When assigning a role:
•	The user must belong to the relevant organization. 
•	The role must be valid for the applicable organizational context. 
•	Organizational-unit restrictions must be respected. 
•	The assignment must not grant access outside the user's authorized organizational scope. 
•	Users must not be able to assign permissions they do not have authority to grant. 
•	Critical administrative roles must not be removed if doing so would leave the organization without an authorized administrator. 
All authorization rules must be enforced by the backend.
________________________________________
Groups
The existing groups model is an optional mechanism for assigning roles to multiple users.
Group
  ↓
Group Roles
  ↓
Roles
  ↓
Permissions
Groups are not the primary authorization model.
Permissions are ultimately derived from roles.
The current model does not require group inheritance or complex group hierarchies.
Future group capabilities should only be introduced when supported by a clear business requirement.
________________________________________
Security Principles
RBAC must follow these principles:
•	Authorization is always enforced server-side. 
•	The frontend is never a security boundary. 
•	Organizational membership does not automatically grant permissions. 
•	A role does not automatically grant access to every organizational context. 
•	Permissions must be evaluated within the applicable organizational context. 
•	Users must not be able to escalate their own privileges. 
•	Administrative authorization changes should be auditable. 
•	Resources outside the user's authorized organizational scope must remain inaccessible. 
•	Authorization must be enforced consistently across all API entry points. 
________________________________________
Separation of Concerns
CFMS separates organizational structure from authorization:
Organizations
    ↓
Define organizational structure

User Membership
    ↓
Defines organizational context

Roles
    ↓
Define responsibilities

Permissions
    ↓
Define capabilities
Changing the organizational hierarchy should not require redesigning the permission catalog.
Likewise, changing permissions should not require redesigning the organizational hierarchy.
________________________________________
Core RBAC Tables
Table	Purpose
users	User identities
organizations	Organizational hierarchy
user_organizations	User organizational membership
roles	Reusable role definitions
permissions	Platform permission catalog
role_permissions	Role-to-permission mapping
user_roles	User-to-role assignments
groups	Optional role-assignment grouping
group_roles	Group-to-role mapping
user_groups	User-to-group membership
________________________________________
Future Evolution
The RBAC foundation may later support:
•	More granular organizational-unit scopes 
•	Temporary role assignments 
•	Delegated administration 
•	Approval-based privilege changes 
•	Advanced authorization auditing 
•	Additional permission models where required 
Future enhancements should extend the existing RBAC foundation rather than introduce a separate authorization model.
________________________________________
RBAC Principle
Organizations define structure.
Membership defines organizational context.
Roles define responsibilities.
Permissions define capabilities.
The backend enforces authorization.

