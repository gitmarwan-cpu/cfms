# Reference Data

## Overview

Reference Data is a Core Platform capability shared by CFMS and future business modules.

Configurable lists must be managed centrally and must not be hard-coded in application or frontend code.

The system uses:

```text
reference_lists
reference_list_items
```

---

## Reference Lists

`reference_lists` defines the list:

```text
key
organization_id
```

* `key` is the stable application identifier.
* `organization_id = NULL` → system-level list.
* `organization_id = X` → organization-specific list.

Items are stored in `reference_list_items`:

```text
code
label_ar
label_en
sort_order
is_active
is_default
meta
```

Application logic should use `code`, not display labels or fixed database IDs.

---

## Organization Overrides

System-level lists provide shared defaults.

An organization may create its own copy when customization is required.

```text
System List
    ↓
Organization Override
```

The override uses **Copy-on-Write**:

1. Copy the system list and its items on the first modification.
2. Apply subsequent changes only to the organization's copy.
3. Never modify the system list through an organization override.

When reading a list:

```text
Organization list exists?
        ↓
   Yes → use it
   No  → use system list
```

This resolution logic must remain centralized in the Reference Data service.

---

## Current CFMS Lists

| Key                        | System Default |
| -------------------------- | -------------- |
| `gender`                   | Yes            |
| `age_group`                | Yes            |
| `complaint_category`       | No             |
| `channel`                  | No             |
| `complaint_type`           | Yes            |
| `priority`                 | No             |
| `complainant_relationship` | No             |

The actual values belong to the database, not the application code.

---

## Validation

Reference-data inputs must be validated against the effective list for the applicable organization.

Validation must confirm:

* List exists.
* Code exists.
* Item is active.
* Item belongs to the applicable effective list.

Use the centralized validation mechanism, for example:

```text
custom(isActiveReferenceCode(listKey))
```

Do not replace configurable reference data with hard-coded `isIn([...])` lists.

---

## Historical Data

Prefer deactivation over deletion when an item is referenced by existing records.

Inactive items may need to remain available for:

* Historical records
* Reports
* Audit
* Referential integrity

---

## Adding a New List

1. Create a migration only if a schema change is required.
2. Create a **dedicated idempotent seeder** for the new list.
3. Do not add new lists to a broad seeder whose global guard could skip them.
4. Existing generic Reference Data APIs normally require no new endpoint.
5. Frontend consumes the list by its `key`; values must not be hard-coded.

Historical Sequelize seeders must remain idempotent because `sequelize-cli` does not reliably track previously executed seeders.

---

## Security

Organization-specific reference data is protected by server-side authorization.

The backend must ensure that users cannot read or modify reference data outside their authorized organizational context.

The frontend is never the source of truth.

---

## Principle

> **Reference Data is centralized.**
> **Codes are stable identifiers.**
> **System lists provide shared defaults.**
> **Organizations may override configurable lists.**
> **Copy-on-Write prevents cross-organization changes.**
> **The database is the source of truth.**
