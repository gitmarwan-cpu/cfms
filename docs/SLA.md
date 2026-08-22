# SLA & Escalation

## Overview

The SLA module automatically:

* Assigns an applicable SLA rule to a complaint.
* Calculates first-response and resolution deadlines.
* Tracks SLA status.
* Escalates overdue complaints.
* Records escalation history.

SLA configuration is organization-specific and enforced server-side.

---

## SLA Components

### SLA Rules

Stored in:

```text
sla_rules
```

Rules may match complaints by:

* Complaint type
* Category
* Priority
* Sensitivity
* Organization

Rules define:

* First-response target
* Resolution target
* Escalation interval
* Maximum escalation level
* Active/inactive status

When multiple rules match, the most specific applicable rule is selected.

If no rule matches, no SLA is assigned.

### Complaint SLA Tracking

SLA state is stored on `complaints`, including:

```text
sla_rule_id
sla_due_at
sla_first_response_due_at
sla_first_responded_at
sla_status
escalation_level
last_escalated_at
```

Terminal complaint statuses stop SLA processing.

### Escalation Events

`complaint_escalation_events` stores an immutable history of manual and automated escalations.

---

## Escalation

Open complaints that exceed their SLA deadline may be escalated automatically.

Escalation:

* Respects the rule's maximum level.
* Uses atomic database updates.
* Prevents duplicate escalation events.
* Records the escalation event.
* Sends notifications to the applicable assignee or organizational manager.

All escalation operations must respect organizational authorization and data scope.

---

## Background Worker

The SLA evaluator runs from:

```text
backend/src/workers/slaWorker.ts
```

It starts with the application outside test environments and evaluates active organizations periodically.

Current behavior:

* Default interval: 60 seconds.
* Prevents overlapping cycles within the same Node.js process.
* Database-level conditional updates provide idempotency across processes.

---

## Current Limitations

### Business Calendars

SLA calculations currently use continuous UTC hours.

Working hours, weekends, and public holidays are not currently supported.

### Worker Scaling

The worker currently uses an in-process Node.js timer.

For large horizontal deployments, a distributed job system or external scheduler may be preferable.

### Production Migration

SLA migrations must be validated against the production migration history before deployment.

Applied migrations must not be rewritten to resolve reconciliation issues.

---

## Principle

> **SLA rules define targets.**
> **Complaints track SLA state.**
> **Escalation handles overdue work.**
> **Escalation events provide an audit trail.**
> **Database operations must be idempotent.**
> **Organizational scope is always enforced server-side.**
