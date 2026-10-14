'use strict';

require('./setup');

const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const slaService = require('../src/services/slaService.ts');

const scopeFor = (userId, tenantId, ...grants) => ({ userId, tenantId, grants });

const makeOrganization = async (suffix) => {
  const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
  return prisma.organizations.create({
    data: {
      legal_name: `SLA Org ${suffix}`,
      slug: `sla-org-${suffix}-${Date.now()}`,
      country: 'Yemen',
      governorate_id: governorate.id,
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      primary_color: '#0e5f66',
      secondary_color: '#0a464b',
      accent_color: '#c77b3f',
      anonymous_complaints_policy: 'allowed',
      notification_settings: {},
      is_active: true,
      create_date: new Date(),
      write_date: new Date(),
    },
  });
};

const makeUser = async (suffix) => prisma.users.create({
  data: {
    full_name: `SLA User ${suffix}`,
    email: `sla-user-${suffix}-${Date.now()}@cfms.local`,
    password_hash: 'not-used-in-service-test',
    is_active: true,
    create_date: new Date(),
    write_date: new Date(),
  },
});

const getLocations = async () => {
  const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
  const district = await prisma.districts.findFirst({
    where: { governorate_id: governorate.id, name_en: 'Yarim' },
  });
  return { governorateId: String(governorate.id), districtId: String(district.id) };
};

const makePayload = (locations, overrides = {}) => ({
  type: 'complaint',
  isAnonymous: true,
  governorateId: locations.governorateId,
  districtId: locations.districtId,
  category: 'service_quality',
  description: 'A sufficiently long complaint description for SLA service testing.',
  consentGiven: true,
  ...overrides,
});

describe('SLA calculation', () => {
  it('calculates due dates as UTC hour offsets from createdAt', () => {
    const createdAt = new Date('2026-08-17T12:00:00.000Z');
    const due = slaService.calculateDueDates(createdAt, 8, 48);
    expect(due.firstResponseDueAt.toISOString()).toBe('2026-08-17T20:00:00.000Z');
    expect(due.dueAt.toISOString()).toBe('2026-08-19T12:00:00.000Z');
  });

  it('marks open complaints overdue at or after the due instant', () => {
    const dueAt = new Date('2026-08-17T12:00:00.000Z');
    expect(slaService.computeSlaStatus({ slaDueAt: dueAt, status: 'new', now: new Date('2026-08-17T11:59:59.000Z') })).toBe('on_track');
    expect(slaService.computeSlaStatus({ slaDueAt: dueAt, status: 'in_review', now: dueAt })).toBe('overdue');
    expect(slaService.computeSlaStatus({ slaDueAt: dueAt, status: 'resolved', now: new Date('2026-08-18T00:00:00.000Z') })).toBe('met');
    expect(slaService.computeSlaStatus({ slaDueAt: null, status: 'new', now: dueAt })).toBe('none');
  });

  it('increments escalation levels from the due instant using the interval', () => {
    const dueAt = new Date('2026-08-17T00:00:00.000Z');
    const base = {
      slaDueAt: dueAt,
      status: 'in_review',
      currentLevel: 0,
      intervalHours: 24,
      maxLevel: 3,
    };
    expect(slaService.computeEscalationLevel({ ...base, now: new Date('2026-08-16T23:59:59.000Z') })).toBe(0);
    expect(slaService.computeEscalationLevel({ ...base, now: dueAt })).toBe(1);
    expect(slaService.computeEscalationLevel({ ...base, now: new Date('2026-08-18T00:00:00.000Z') })).toBe(2);
    expect(slaService.computeEscalationLevel({ ...base, now: new Date('2026-08-20T00:00:00.000Z') })).toBe(3);
    expect(slaService.computeEscalationLevel({ ...base, currentLevel: 2, now: dueAt })).toBe(2);
  });
});

describe('Prisma SLA service', () => {
  let organization;
  let otherOrganization;
  let locations;
  let actor;

  beforeAll(async () => {
    organization = await makeOrganization('primary');
    otherOrganization = await makeOrganization('other');
    locations = await getLocations();
    actor = await makeUser('actor');
    await prisma.user_organizations.create({
      data: {
        user_id: actor.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
  });

  it('creates organization-scoped SLA rules and applies due dates on complaint create', async () => {
    const rule = await slaService.createSlaRule(
      organization.id,
      {
        name: 'Default complaint SLA',
        complaintType: 'complaint',
        firstResponseHours: 8,
        resolutionHours: 48,
        escalationIntervalHours: 24,
        maxEscalationLevel: 3,
      },
      actor.id
    );
    expect(rule.organizationId).toBe(organization.id);
    expect(rule.firstResponseHours).toBe(8);

    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    expect(created.complaint.slaRuleId).toBe(rule.id);
    expect(created.complaint.slaStatus).toBe('on_track');
    expect(created.complaint.escalationLevel).toBe(0);
    expect(new Date(created.complaint.slaDueAt).getTime() - new Date(created.complaint.createdAt).getTime()).toBe(
      48 * slaService.MS_PER_HOUR
    );
    expect(
      new Date(created.complaint.slaFirstResponseDueAt).getTime() - new Date(created.complaint.createdAt).getTime()
    ).toBe(8 * slaService.MS_PER_HOUR);

    const audits = await prisma.audit_logs.findMany({
      where: { organization_id: organization.id, entity_type: 'sla_rule', action: 'sla_rule.created' },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps SLA rules isolated between organizations', async () => {
    const otherRule = await slaService.createSlaRule(
      otherOrganization.id,
      {
        name: 'Other org SLA',
        firstResponseHours: 1,
        resolutionHours: 2,
        escalationIntervalHours: 1,
      },
      actor.id
    );
    const listed = await slaService.listSlaRules(organization.id);
    expect(listed.some((rule) => rule.id === otherRule.id)).toBe(false);
    await expect(slaService.updateSlaRule(organization.id, otherRule.id, { name: 'Hijack' }, actor.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    const created = await complaintService.createComplaint(otherOrganization.id, makePayload(locations));
    expect(created.complaint.slaRuleId).toBe(otherRule.id);
    const ownCreated = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { category: 'staff_behavior' })
    );
    expect(ownCreated.complaint.organizationId).toBe(organization.id);
    expect(ownCreated.complaint.slaRuleId).not.toBe(otherRule.id);
  });

  it('marks overdue complaints, raises escalation levels, and notifies the assignee', async () => {
    const rule = await slaService.createSlaRule(
      organization.id,
      {
        name: 'Fast SLA',
        complaintType: 'complaint',
        categoryItemId: (
          await prisma.reference_list_items.findFirst({
            where: { code: 'distribution_issue', reference_lists: { key: 'complaint_category' } },
          })
        ).id,
        firstResponseHours: 1,
        resolutionHours: 2,
        escalationIntervalHours: 2,
        maxEscalationLevel: 3,
      },
      actor.id
    );
    const created = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { category: 'distribution_issue' })
    );
    expect(created.complaint.slaRuleId).toBe(rule.id);
    await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: actor.id },
      actor.id,
      scopeFor(actor.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueAt = new Date(created.complaint.slaDueAt);
    const firstWave = await slaService.evaluateOrganizationSla(organization.id, {
      now: dueAt,
      actorUserId: actor.id,
    });
    const firstResult = firstWave.complaints.find((item) => item.id === created.complaint.id);
    expect(firstResult.slaStatus).toBe('overdue');
    expect(firstResult.escalationLevel).toBe(1);

    const secondWave = await slaService.evaluateOrganizationSla(organization.id, {
      now: new Date(dueAt.getTime() + 2 * slaService.MS_PER_HOUR),
      actorUserId: actor.id,
    });
    const secondResult = secondWave.complaints.find((item) => item.id === created.complaint.id);
    expect(secondResult.escalationLevel).toBe(2);

    const events = await prisma.complaint_escalation_events.findMany({
      where: { organization_id: organization.id, complaint_id: created.complaint.id },
      orderBy: { created_at: 'asc' },
    });
    expect(events.map((event) => event.to_level)).toEqual([1, 2]);
    expect(events.every((event) => event.reason === 'overdue')).toBe(true);

    const notifications = await prisma.notifications.findMany({
      where: {
        organization_id: organization.id,
        user_id: actor.id,
        notification_type: 'complaint.escalated',
        entity_id: created.complaint.id,
      },
    });
    expect(notifications.length).toBe(2);

    const audits = await prisma.audit_logs.findMany({
      where: { organization_id: organization.id, entity_id: created.complaint.id, action: 'complaint.escalated' },
    });
    expect(audits.length).toBe(2);
  });

  it('supports manual escalation and rejects a second-org complaint id', async () => {
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: actor.id },
      actor.id,
      scopeFor(actor.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    const escalated = await slaService.escalateComplaint(
      organization.id,
      created.complaint.id,
      { note: 'Need manager' },
      actor.id,
      scopeFor(actor.id, organization.id, { code: 'complaints.escalate', orgUnitId: null })
    );
    expect(escalated.escalationLevel).toBe(1);

    const foreign = await complaintService.createComplaint(otherOrganization.id, makePayload(locations));
    await expect(
      slaService.escalateComplaint(
        organization.id,
        foreign.complaint.id,
        { note: 'cross tenant' },
        actor.id,
        scopeFor(actor.id, organization.id, { code: 'complaints.escalate', orgUnitId: null })
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      slaService.evaluateOrganizationSla(otherOrganization.id, { now: new Date('2099-01-01T00:00:00.000Z') })
    ).resolves.toEqual(expect.objectContaining({ evaluated: expect.any(Number) }));
    const untouched = await complaintService.getComplaintById(organization.id, created.complaint.id);
    expect(untouched.escalationLevel).toBe(1);
  });

  it('matches priority-specific SLA rules over generic rules', async () => {
    const urgentPriority = await prisma.reference_list_items.findFirst({
      where: { code: 'urgent', reference_lists: { key: 'priority' } },
    });
    const lowPriority = await prisma.reference_list_items.findFirst({
      where: { code: 'low', reference_lists: { key: 'priority' } },
    });

    const urgentRule = await slaService.createSlaRule(
      organization.id,
      {
        name: 'Urgent Priority SLA',
        complaintType: 'complaint',
        priorityItemId: urgentPriority.id,
        firstResponseHours: 2,
        resolutionHours: 6,
        escalationIntervalHours: 4,
      },
      actor.id
    );

    const urgentComplaint = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { priority: 'urgent' })
    );
    expect(urgentComplaint.complaint.slaRuleId).toBe(urgentRule.id);
    expect(new Date(urgentComplaint.complaint.slaDueAt).getTime() - new Date(urgentComplaint.complaint.createdAt).getTime()).toBe(
      6 * slaService.MS_PER_HOUR
    );

    const normalComplaint = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { priority: 'low' })
    );
    expect(normalComplaint.complaint.slaRuleId).not.toBe(urgentRule.id);
  });

  it('runs automated multi-tenant background evaluation worker cycle', async () => {
    const { runSlaWorkerCycle, startSlaEvaluationWorker, stopSlaEvaluationWorker } = require('../src/workers/slaWorker');
    const timer1 = startSlaEvaluationWorker(5000);
    const timer2 = startSlaEvaluationWorker(5000);
    expect(timer1).toBe(timer2);
    stopSlaEvaluationWorker();

    const result = await runSlaWorkerCycle();
    expect(result).toBeDefined();
    expect(result.organizationsEvaluated).toBeGreaterThanOrEqual(2);
  });

  it('prevents duplicate escalation events and notifications on repeated evaluation', async () => {
    const created = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { category: 'distribution_issue' })
    );
    await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: actor.id },
      actor.id,
      scopeFor(actor.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueTime = new Date(created.complaint.slaDueAt).getTime() + 60000;
    const pastTime = new Date(dueTime);
    await slaService.evaluateOrganizationSla(organization.id, { now: pastTime, actorUserId: actor.id });
    await slaService.evaluateOrganizationSla(organization.id, { now: pastTime, actorUserId: actor.id });

    const events = await prisma.complaint_escalation_events.findMany({
      where: { organization_id: organization.id, complaint_id: created.complaint.id, to_level: 1 },
    });
    expect(events.length).toBe(1);

    const notifications = await prisma.notifications.findMany({
      where: {
        organization_id: organization.id,
        user_id: actor.id,
        notification_type: 'complaint.escalated',
        entity_id: created.complaint.id,
      },
    });
    expect(notifications.length).toBe(1);
  });
});

describe('GAP-01: escalation assignment snapshots', () => {
  let org;
  let actor;
  let assignee;
  let operationalNode;
  let locations;

  beforeAll(async () => {
    const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
    const district = await prisma.districts.findFirst({
      where: { governorate_id: governorate.id, name_en: 'Yarim' },
    });
    locations = { governorateId: String(governorate.id), districtId: String(district.id) };
    const ts = Date.now();

    org = await prisma.organizations.create({
      data: {
        legal_name: `GAP01 Org ${ts}`,
        slug: `gap01-org-${ts}`,
        country: 'Yemen',
        governorate_id: governorate.id,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        primary_color: '#0e5f66',
        secondary_color: '#0a464b',
        accent_color: '#c77b3f',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    operationalNode = await prisma.organizations.create({
      data: {
        legal_name: `GAP01 Operational Node ${ts}`,
        slug: `gap01-node-${ts}`,
        country: 'Yemen',
        governorate_id: governorate.id,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        primary_color: '#0e5f66',
        secondary_color: '#0a464b',
        accent_color: '#c77b3f',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        parent_id: org.id,
        root_organization_id: org.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    actor = await prisma.users.create({
      data: {
        full_name: `GAP01 Actor ${ts}`,
        email: `gap01-actor-${ts}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    assignee = await prisma.users.create({
      data: {
        full_name: `GAP01 Assignee ${ts}`,
        email: `gap01-assignee-${ts}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    await prisma.user_organizations.create({
      data: {
        user_id: actor.id,
        organization_id: org.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    await prisma.user_organizations.create({
      data: {
        user_id: assignee.id,
        organization_id: org.id,
        is_primary: false,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    // Create an SLA rule so complaints get sla_due_at set
    await slaService.createSlaRule(
      org.id,
      {
        name: 'GAP01 Fast SLA',
        complaintType: 'complaint',
        firstResponseHours: 1,
        resolutionHours: 2,
        escalationIntervalHours: 2,
        maxEscalationLevel: 3,
      },
      actor.id
    );
  });

  const makeComplaint = () =>
    complaintService.createComplaint(org.id, {
      type: 'complaint',
      isAnonymous: true,
      governorateId: locations.governorateId,
      districtId: locations.districtId,
      category: 'service_quality',
      description: 'A complaint for GAP-01 snapshot testing.',
      consentGiven: true,
    });

  it('records the assigned user and organization node at the time of escalation', async () => {
    const { complaint } = await makeComplaint();
    // Assign to a user and the operational organization node
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: assignee.id, assigneeOrganizationId: operationalNode.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    // Trigger escalation past the due date
    const dueAt = new Date(complaint.slaDueAt);
    await slaService.evaluateOrganizationSla(org.id, { now: dueAt, actorUserId: actor.id });

    const event = await prisma.complaint_escalation_events.findFirst({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { created_at: 'desc' },
    });

    expect(event).not.toBeNull();
    expect(event.assigned_to_user_id).toBe(assignee.id);
    expect(event.assigned_to_organization_id).toBe(operationalNode.id);
  });

  it('records a null user and the operational organization node for organization-only assignment', async () => {
    const { complaint } = await makeComplaint();
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeOrganizationId: operationalNode.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueAt = new Date(complaint.slaDueAt);
    await slaService.evaluateOrganizationSla(org.id, { now: dueAt, actorUserId: actor.id });

    const event = await prisma.complaint_escalation_events.findFirst({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { created_at: 'desc' },
    });

    expect(event).toMatchObject({
      assigned_to_user_id: null,
      assigned_to_organization_id: operationalNode.id,
    });
  });

  it('records both assignment IDs for manual escalation', async () => {
    const { complaint } = await makeComplaint();
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: assignee.id, assigneeOrganizationId: operationalNode.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    await slaService.escalateComplaint(
      org.id,
      complaint.id,
      { note: 'Manual GAP-01 escalation' },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.escalate', orgUnitId: null })
    );

    const event = await prisma.complaint_escalation_events.findFirst({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { created_at: 'desc' },
    });

    expect(event).toMatchObject({
      reason: 'manual',
      assigned_to_user_id: assignee.id,
      assigned_to_organization_id: operationalNode.id,
    });
  });

  it('stores null for both snapshot fields when complaint has no assignment at escalation time', async () => {
    const { complaint } = await makeComplaint();
    // Do NOT assign — escalate immediately past due date

    const dueAt = new Date(complaint.slaDueAt);
    await slaService.evaluateOrganizationSla(org.id, { now: dueAt, actorUserId: actor.id });

    const event = await prisma.complaint_escalation_events.findFirst({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { created_at: 'desc' },
    });

    expect(event).not.toBeNull();
    expect(event.assigned_to_user_id).toBeNull();
    expect(event.assigned_to_organization_id).toBeNull();
  });

  it('does NOT mutate the historical snapshot after the complaint is reassigned', async () => {
    const { complaint } = await makeComplaint();
    // First assign to assignee, then escalate to capture snapshot
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: assignee.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueAt = new Date(complaint.slaDueAt);
    await slaService.evaluateOrganizationSla(org.id, { now: dueAt, actorUserId: actor.id });

    // Capture the event snapshot before reassignment
    const eventBefore = await prisma.complaint_escalation_events.findFirst({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { created_at: 'desc' },
    });
    expect(eventBefore.assigned_to_user_id).toBe(assignee.id);

    // Now reassign to the actor (different user)
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: actor.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    // The escalation event record must be unchanged
    const eventAfter = await prisma.complaint_escalation_events.findFirst({
      where: { id: eventBefore.id },
    });
    expect(eventAfter.assigned_to_user_id).toBe(assignee.id);
    expect(eventAfter.assigned_to_organization_id).toBeNull();
  });

  it('captures the new assignment on a later escalation while preserving the first event', async () => {
    const { complaint } = await makeComplaint();
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: assignee.id, assigneeOrganizationId: operationalNode.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueAt = new Date(complaint.slaDueAt);
    await slaService.evaluateOrganizationSla(org.id, { now: dueAt, actorUserId: actor.id });

    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: actor.id, assigneeOrganizationId: operationalNode.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const secondEscalationAt = new Date(dueAt.getTime() + 2 * slaService.MS_PER_HOUR);
    await slaService.evaluateOrganizationSla(org.id, { now: secondEscalationAt, actorUserId: actor.id });
    await slaService.evaluateOrganizationSla(org.id, { now: secondEscalationAt, actorUserId: actor.id });

    const events = await prisma.complaint_escalation_events.findMany({
      where: { complaint_id: complaint.id, organization_id: org.id },
      orderBy: { to_level: 'asc' },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      to_level: 1,
      assigned_to_user_id: assignee.id,
      assigned_to_organization_id: operationalNode.id,
    });
    expect(events[1]).toMatchObject({
      to_level: 2,
      assigned_to_user_id: actor.id,
      assigned_to_organization_id: operationalNode.id,
    });
  });

  it('existing escalation behavior (level increment) remains intact', async () => {
    const { complaint } = await makeComplaint();
    await complaintService.assignComplaint(
      org.id,
      complaint.id,
      { assigneeUserId: assignee.id },
      actor.id,
      scopeFor(actor.id, org.id, { code: 'complaints.assign', orgUnitId: null })
    );

    const dueAt = new Date(complaint.slaDueAt);
    const result = await slaService.evaluateOrganizationSla(org.id, {
      now: dueAt,
      actorUserId: actor.id,
    });
    const item = result.complaints.find((c) => c.id === complaint.id);
    expect(item.escalationLevel).toBe(1);
    expect(item.slaStatus).toBe('overdue');
  });
});
