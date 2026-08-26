# Service Level Agreement (SLA) & Escalation Architecture

## Overview

The SLA & Escalation module in CFMS automatically computes response/resolution deadlines for complaints, evaluates active complaints against rules, and escalates overdue complaints to appropriate assignees or unit managers.

---

## 1. SLA Architecture

SLA enforcement consists of three core components:

1. **SLA Rules (`sla_rules`)**:
   - Organization-scoped configuration defining time limits and escalation criteria.
   - Core fields:
     - `complaint_type`: `'complaint'` | `'proposal'` | `null` (matches any)
     - `category_item_id`: Reference list item for `complaint_category` | `null`
     - `priority_item_id`: Reference list item for `priority` | `null`
     - `is_sensitive`: `boolean` | `null`
     - `first_response_hours`: Target hours for initial action/response.
     - `resolution_hours`: Target hours for complaint resolution (`sla_due_at`).
     - `escalation_intervalHours`: Hours between subsequent automatic escalation steps.
     - `max_escalation_level`: Upper bound for automated escalation (default: 3).
     - `is_active`: Status flag for rule matching.

2. **Complaint SLA Tracking (`complaints`)**:
   - Fields populated/updated dynamically:
     - `sla_rule_id`: Assigned matching SLA rule.
     - `sla_due_at`: UTC timestamp when complaint resolution is due.
     - `sla_first_response_due_at`: Target timestamp for first response.
     - `sla_first_responded_at`: Timestamp when first status transition occurred.
     - `sla_status`: `'on_track'` | `'overdue'` | `'escalated'` | `'resolved'` | `'closed'`.
     - `escalation_level`: Integer level (0 = initial, up to `max_escalation_level`).
     - `last_escalated_at`: Timestamp of last escalation event.

3. **Escalation Events (`complaint_escalation_events`)**:
   - Immutable audit trail of all manual and automated escalations.
   - Records `from_level`, `to_level`, `reason` (`'overdue'` | `'manual'`), `note`, and `triggered_by_user_id`.

---

## 2. Priority & Rule Matching Logic

When a complaint is submitted, `resolveComplaintSlaFields` finds the active SLA rule with the highest specificity score matching the organization context.

### Specificity Scoring

A candidate rule matches if all non-null rule criteria equal the complaint attributes:
- `rule.complaint_type` matches `complaint.type` (or rule field is null)
- `rule.category_item_id` matches `complaint.categoryItemId` (or rule field is null)
- `rule.priority_item_id` matches `complaint.priorityItemId` (or rule field is null)
- `rule.is_sensitive` matches `complaint.isSensitive` (or rule field is null)

When multiple rules match, the rule with the highest specificity score is selected:
$$\text{Score} = (8 \times \text{type\_matched}) + (4 \times \text{category\_matched}) + (2 \times \text{priority\_matched}) + (1 \times \text{sensitive\_matched})$$

Tie-breaking: Lower `id` wins. If no rule matches, SLA calculation falls back to `sla_due_at = null` (no SLA assigned).

---

## 3. Escalation Logic & Idempotency

- **Status Transition Tracking**:
  - Closed/terminal status (`resolved`, `closed`, `rejected`) stops SLA timer and marks `sla_status` appropriately.
  - When status changes from `new`, `sla_first_responded_at` is set if previously null.

- **Automated Level Increment**:
  - For open complaints exceeding `sla_due_at`:
    $$\text{level} = \min\left(1 + \lfloor \frac{\text{now} - \text{sla\_due\_at}}{\text{escalation\_interval\_hours}} \rfloor, \text{max\_escalation\_level}\right)$$
  - Escalation is executed via atomic conditional update:
    ```sql
    UPDATE complaints
    SET escalation_level = :toLevel, last_escalated_at = :now, sla_status = :slaStatus, updated_at = :now
    WHERE id = :complaintId AND organization_id = :organizationId AND escalation_level < :toLevel;
    ```
  - If zero rows are updated (i.e. another process or tick already escalated to `:toLevel` or higher), the escalation process terminates early—preventing duplicate escalation events, notifications, or audit logs.

- **Notification Dispatch**:
  - Escalation notifies the assigned user. If no user is assigned, it notifies the manager of the assigned organization unit (`org_units.manager_user_id`).

---

## 4. Background Worker Behavior

- **Implementation**: Located at `backend/src/workers/slaWorker.ts`.
- **Initialization**: Started in `backend/src/server.ts` upon HTTP server boot when `NODE_ENV !== 'test'`.
- **Execution Cycle**:
  - Runs periodically (default interval: 60 seconds).
  - Iterates through all active organizations and runs `evaluateOrganizationSla`.
  - In-memory lock (`isCycleRunning`) prevents overlapping cycles within the Node process.
  - Timer singleton (`startSlaEvaluationWorker`) prevents accidental duplicate intervals.

---

## 5. Known Limitations & Production Constraints

1. **No Business Calendar Support**:
   - SLA calculations currently use 24/7 continuous UTC hours (`addHoursUtc`). Working hours, weekends, and public holidays are not excluded.
2. **In-Process Worker Architecture**:
   - The SLA evaluation worker operates in-process via Node.js `setInterval`. While atomic database updates ensure idempotency across multiple instances, enterprise production deployments may prefer a distributed job queue (e.g. BullMQ / Redis / external cron) if scaling out horizontally.
3. **Production Migration Reconciliation Pending**:
   - All migrations (`20260817120000_add_sla_and_escalation` and `20260817150000_add_sla_priority_support`) are applied and verified on `cfms_test`. Direct deployment to `cfms_db` requires production migration history reconciliation.
