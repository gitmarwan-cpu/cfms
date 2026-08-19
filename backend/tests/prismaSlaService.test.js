'use strict';

require('./setup');

const prisma = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const slaService = require('../src/services/slaService.ts');

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
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
};

const makeUser = async (suffix) => prisma.users.create({
  data: {
    full_name: `SLA User ${suffix}`,
    email: `sla-user-${suffix}-${Date.now()}@cfms.local`,
    password_hash: 'not-used-in-service-test',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
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
        created_at: new Date(),
        updated_at: new Date(),
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
      actor.id
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
      actor.id
    );
    const escalated = await slaService.escalateComplaint(organization.id, created.complaint.id, { note: 'Need manager' }, actor.id);
    expect(escalated.escalationLevel).toBe(1);

    const foreign = await complaintService.createComplaint(otherOrganization.id, makePayload(locations));
    await expect(
      slaService.escalateComplaint(organization.id, foreign.complaint.id, { note: 'cross tenant' }, actor.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      slaService.evaluateOrganizationSla(otherOrganization.id, { now: new Date('2099-01-01T00:00:00.000Z') })
    ).resolves.toEqual(expect.objectContaining({ evaluated: expect.any(Number) }));
    const untouched = await complaintService.getComplaintById(organization.id, created.complaint.id);
    expect(untouched.escalationLevel).toBe(1);
  });

  it('matches priority-specific SLA rules over generic rules', async () => {
    const urgentPriority = await prisma.reference_list_items.findFirst({
      where: { code: 'urgent', reference_lists: { key: 'complaint_priority' } },
    });
    const lowPriority = await prisma.reference_list_items.findFirst({
      where: { code: 'low', reference_lists: { key: 'complaint_priority' } },
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
      actor.id
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
