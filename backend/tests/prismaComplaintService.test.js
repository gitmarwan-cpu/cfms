'use strict';

require('./setup');

const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const reportService = require('../src/services/reportService.ts');
const referenceDataService = require('../src/services/referenceDataService');

const makeOrganization = async (suffix) => {
  const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
  return prisma.organizations.create({
    data: {
      legal_name: `Prisma Complaint ${suffix}`,
      slug: `prisma-complaint-${suffix}-${Date.now()}`,
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
    full_name: `Complaint User ${suffix}`,
    email: `complaint-user-${suffix}-${Date.now()}@cfms.local`,
    password_hash: 'not-used-in-service-test',
    is_active: true,
    create_date: new Date(),
    write_date: new Date(),
  },
});

const getLocations = async () => {
  const actualGovernorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
  const district = await prisma.districts.findFirst({
    where: { governorate_id: actualGovernorate.id, name_en: 'Yarim' },
  });
  const otherDistrict = await prisma.districts.findFirst({ where: { name_en: 'Ahwar' } });
  return {
    governorateId: String(actualGovernorate.id),
    districtId: String(district.id),
    otherDistrictId: String(otherDistrict.id),
  };
};

const makePayload = (locations, overrides = {}) => ({
  type: 'complaint',
  isAnonymous: true,
  governorateId: locations.governorateId,
  districtId: locations.districtId,
  category: 'service_quality',
  description: 'A sufficiently long complaint description for Prisma service testing.',
  consentGiven: true,
  ...overrides,
});

const scopeFor = (userId, tenantId, ...grants) => ({ userId, tenantId, grants });

const countComplaintAudits = (organizationId, complaintId, action) =>
  prisma.audit_logs.count({
    where: { organization_id: organizationId, entity_id: complaintId, action },
  });

const complaintAuditCounts = async (organizationId, complaintId) => ({
  assigned: await countComplaintAudits(organizationId, complaintId, 'complaint.assigned'),
  reassigned: await countComplaintAudits(organizationId, complaintId, 'complaint.reassigned'),
  unassigned: await countComplaintAudits(organizationId, complaintId, 'complaint.unassigned'),
});

const auditDelta = (before, after) => ({
  assigned: after.assigned - before.assigned,
  reassigned: after.reassigned - before.reassigned,
  unassigned: after.unassigned - before.unassigned,
});

describe('Prisma complaint service', () => {
  let organization;
  let locations;

  beforeAll(async () => {
    organization = await makeOrganization('service');
    locations = await getLocations();
  });

  it('creates a normal complaint and preserves default website channel', async () => {
    const result = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { isAnonymous: false, fullName: 'Identified User', phone: '777123456' })
    );

    const complaint = await prisma.complaints.findUnique({ where: { id: result.complaint.id } });
    expect(complaint).toMatchObject({
      organization_id: organization.id,
      is_anonymous: false,
      status: 'new',
    });
    expect(complaint.workflow_state_id).not.toBeNull();
    const channel = await prisma.reference_list_items.findUnique({ where: { id: complaint.channel_item_id } });
    expect(channel.code).toBe('website');
    expect(result.trackingPin).toMatch(/^\d{6}$/);
    await expect(prisma.audit_logs.findMany({ where: { organization_id: organization.id, entity_id: result.complaint.id, action: 'complaint.created' } })).resolves.toHaveLength(1);
  });

  it('creates anonymous complaints without a complainant', async () => {
    const result = await complaintService.createComplaint(organization.id, makePayload(locations));
    const complaint = await prisma.complaints.findUnique({ where: { id: result.complaint.id } });
    expect(complaint).toMatchObject({ is_anonymous: true, complainant_id: null });
  });

  it('stores complainant relationship_item_id and maps the relationship item', async () => {
    const result = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, {
        isAnonymous: false,
        fullName: 'Relationship User',
        phone: '777000111',
        relationship: 'beneficiary',
      })
    );
    const complaint = await prisma.complaints.findUnique({ where: { id: result.complaint.id } });
    const complainant = await prisma.complainants.findUnique({ where: { id: complaint.complainant_id } });
    const relationship = await prisma.reference_list_items.findUnique({ where: { id: complainant.relationship_item_id } });
    expect(relationship.code).toBe('beneficiary');
    expect(result.complaint.complainant.relationshipItem.code).toBe('beneficiary');
  });

  it('rejects a governorate/district mismatch and inactive reference item', async () => {
    await expect(
      complaintService.createComplaint(organization.id, makePayload(locations, { districtId: locations.otherDistrictId }))
    ).rejects.toMatchObject({ statusCode: 422 });

    const inactive = await referenceDataService.createItem('complaint_category', organization.id, {
      code: 'inactive_for_complaint_test',
      labelAr: 'Inactive',
    });
    await referenceDataService.deactivateItem('complaint_category', organization.id, inactive.id);
    await expect(
      complaintService.createComplaint(organization.id, makePayload(locations, { category: inactive.code }))
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('applies forcesSensitive from category metadata', async () => {
    const forced = await referenceDataService.createItem('complaint_category', organization.id, {
      code: 'forced_sensitive_for_complaint_test',
      labelAr: 'Forced sensitive',
      meta: { forcesSensitive: true },
    });
    const result = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { category: forced.code })
    );
    const complaint = await prisma.complaints.findUnique({ where: { id: result.complaint.id } });
    expect(complaint.is_sensitive).toBe(true);
  });

  it('stores attachments and initial status history in the same creation flow', async () => {
    const result = await complaintService.createComplaint(
      organization.id,
      makePayload(locations),
      [{ originalname: 'evidence.txt', filename: 'stored-evidence.txt', mimetype: 'text/plain', size: 12 }]
    );
    const attachments = await prisma.complaint_attachments.findMany({ where: { complaint_id: result.complaint.id } });
    const history = await prisma.complaint_status_history.findMany({ where: { complaint_id: result.complaint.id } });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ original_name: 'evidence.txt', stored_file_name: 'stored-evidence.txt' });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ from_status: null, to_status: 'new', changed_by_user_id: null });
  });

  it('keeps reference codes unique and supports list pagination and filters', async () => {
    const first = await complaintService.createComplaint(organization.id, makePayload(locations));
    const second = await complaintService.createComplaint(organization.id, makePayload(locations, { isSensitive: true }));
    expect(first.complaint.referenceCode).not.toBe(second.complaint.referenceCode);

    const page = await complaintService.listComplaints(organization.id, {
      page: '1',
      limit: '1',
      status: 'new',
      isSensitive: 'true',
    });
    expect(page.pagination.limit).toBe(1);
    expect(page.data).toHaveLength(1);
    expect(page.data[0].isSensitive).toBe(true);
  });

  it('enforces tenant isolation for get and list operations', async () => {
    const otherOrganization = await makeOrganization('other');
    const otherComplaint = await complaintService.createComplaint(otherOrganization.id, makePayload(locations));

    await expect(complaintService.getComplaintById(organization.id, String(otherComplaint.complaint.id)))
      .rejects.toMatchObject({ statusCode: 404 });
    const ownList = await complaintService.listComplaints(organization.id, {});
    expect(ownList.data.some((complaint) => complaint.id === otherComplaint.complaint.id)).toBe(false);
  });

  it('gets complaints, updates status, and records history from/to/note/user', async () => {
    const user = await makeUser('status');
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const updated = await complaintService.updateComplaintStatus(
      organization.id,
      String(created.complaint.id),
      'in_review',
      'Assigned for review',
      String(user.id),
      scopeFor(user.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    expect(updated).toMatchObject({ id: created.complaint.id, status: 'in_review' });
    expect(updated.statusHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromStatus: null, toStatus: 'new' }),
      expect.objectContaining({ fromStatus: 'new', toStatus: 'in_review', note: 'Assigned for review', changedByUserId: user.id }),
    ]));
    const fetched = await complaintService.getComplaintById(organization.id, String(created.complaint.id));
    expect(fetched.id).toBe(created.complaint.id);
    await expect(prisma.audit_logs.findMany({ where: { organization_id: organization.id, entity_id: created.complaint.id, action: 'complaint.status_changed' } })).resolves.toEqual([
      expect.objectContaining({ metadata: { fromStatus: 'new', toStatus: 'in_review' }, actor_user_id: user.id }),
    ]);
  });

  it('rejects status changes that are not defined by the complaint workflow', async () => {
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const actor = await makeUser('invalid-status');

    await expect(
      complaintService.updateComplaintStatus(
        organization.id,
        String(created.complaint.id),
        'closed',
        null,
        null,
        scopeFor(
          actor.id,
          organization.id,
          { code: 'complaints.assign', orgUnitId: null },
          { code: 'complaints.close', orgUnitId: null }
        )
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('assigns, reassigns, and unassigns complaints only to active organization members', async () => {
    const assignee = await makeUser('assignee');
    await prisma.user_organizations.create({
      data: {
        user_id: assignee.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    const secondAssignee = await makeUser('second-assignee');
    await prisma.user_organizations.create({
      data: {
        user_id: secondAssignee.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const complaintId = created.complaint.id;
    const auditCounts = () => complaintAuditCounts(organization.id, complaintId);

    // nothing -> user only: complaint.assigned
    let before = await auditCounts();
    const assigned = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: assignee.id },
      assignee.id,
      scopeFor(assignee.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    expect(assigned.assignedToUserId).toBe(assignee.id);
    expect(assigned.assignedToOrganizationId).toBeNull();
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 1, reassigned: 0, unassigned: 0 });

    // user A -> user B: complaint.reassigned
    before = await auditCounts();
    const reassigned = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: secondAssignee.id, reason: '  تغيير المسؤول  ' },
      assignee.id,
      scopeFor(assignee.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    expect(reassigned.assignedToUserId).toBe(secondAssignee.id);
    expect(reassigned.assignedToOrganizationId).toBeNull();
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 1, unassigned: 0 });
    const reassignedAudit = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, entity_id: complaintId, action: 'complaint.reassigned' },
      orderBy: { id: 'desc' },
    });
    expect(reassignedAudit?.metadata).toMatchObject({ reason: 'تغيير المسؤول' });

    // identical user again: no assignment audit event
    before = await auditCounts();
    const unchanged = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: secondAssignee.id },
      assignee.id,
      scopeFor(assignee.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    expect(unchanged.assignedToUserId).toBe(secondAssignee.id);
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 0 });

    // user -> nothing: complaint.unassigned
    before = await auditCounts();
    const unassigned = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: null, assigneeOrganizationId: null },
      assignee.id,
      scopeFor(assignee.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    expect(unassigned.assignedToUserId).toBeNull();
    expect(unassigned.assignedToOrganizationId).toBeNull();
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 1 });
  });

  it('assigns complaints to active tenant organization nodes and rejects cross-tenant or inactive nodes', async () => {
    const actor = await makeUser('team-assigner');
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

    const makeOrgNode = async (suffix) => {
      const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
      return prisma.organizations.create({
        data: {
          legal_name: suffix,
          slug: `prisma-complaint-team-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          country: 'Yemen',
          governorate_id: governorate.id,
          default_language: 'ar',
          timezone: 'Asia/Aden',
          date_format: 'DD/MM/YYYY',
          anonymous_complaints_policy: 'allowed',
          parent_id: organization.id,
          root_organization_id: organization.id,
          create_date: new Date(),
          write_date: new Date(),
        },
      });
    };

    const orgNode = await makeOrgNode('Complaints Team');
    const secondOrgNode = await makeOrgNode('Follow-up Team');
    const otherOrganization = await makeOrganization('team-other');
    const foreignNode = await makeOrgNode('Foreign Team');
    await prisma.organizations.update({ where: { id: foreignNode.id }, data: { root_organization_id: otherOrganization.id } });
    const inactiveNode = await makeOrgNode('Inactive Team');
    await prisma.organizations.update({ where: { id: inactiveNode.id }, data: { is_active: false } });


    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const complaintId = created.complaint.id;
    const auditCounts = () => complaintAuditCounts(organization.id, complaintId);

    // nothing -> node only: complaint.assigned
    let before = await auditCounts();
    const teamAssigned = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeOrganizationId: orgNode.id },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(teamAssigned.assignedToOrganizationId).toBe(orgNode.id);
    expect(teamAssigned.assignedToUserId).toBeNull();
    expect(teamAssigned.assignedToOrganization).toMatchObject({ id: orgNode.id, name: 'Complaints Team' });
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 1, reassigned: 0, unassigned: 0 });
    const firstAssignAudit = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, entity_id: complaintId, action: 'complaint.assigned' },
      orderBy: { id: 'desc' },
    });
    expect(firstAssignAudit?.metadata).toMatchObject({
      previousAssigneeOrganizationId: null,
      assigneeOrganizationId: orgNode.id,
    });

    // node A -> node B: complaint.reassigned with the previous node preserved in metadata
    before = await auditCounts();
    const nodeChanged = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeOrganizationId: secondOrgNode.id },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(nodeChanged.assignedToOrganizationId).toBe(secondOrgNode.id);
    expect(nodeChanged.assignedToUserId).toBeNull();
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 1, unassigned: 0 });
    const nodeChangeAudit = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, entity_id: complaintId, action: 'complaint.reassigned' },
      orderBy: { id: 'asc' },
    });
    expect(nodeChangeAudit?.metadata).toMatchObject({
      previousAssigneeOrganizationId: orgNode.id,
      assigneeOrganizationId: secondOrgNode.id,
    });

    const assignee = await makeUser('team-member');
    await prisma.user_organizations.create({
      data: {
        user_id: assignee.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    // node only -> node + user: complaint.assigned (no existing value was replaced)
    before = await auditCounts();
    const bothAssigned = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: assignee.id, assigneeOrganizationId: secondOrgNode.id },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(bothAssigned.assignedToUserId).toBe(assignee.id);
    expect(bothAssigned.assignedToOrganizationId).toBe(secondOrgNode.id);
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 1, reassigned: 0, unassigned: 0 });

    await expect(
      prisma.notifications.findMany({
        where: {
          organization_id: organization.id,
          entity_id: complaintId,
          notification_type: 'complaint.assigned',
          user_id: assignee.id,
        },
      })
    ).resolves.toHaveLength(1);

    // rejected assignments must not record any assignment audit event
    before = await auditCounts();
    await expect(
      complaintService.assignComplaint(
        organization.id,
        complaintId,
        { assigneeOrganizationId: foreignNode.id },
        actor.id,
        scopeFor(
          actor.id,
          organization.id,
          { code: 'complaints.assign', orgUnitId: null },
          { code: 'complaints.transfer', orgUnitId: null }
        )
      )
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      complaintService.assignComplaint(
        organization.id,
        complaintId,
        { assigneeOrganizationId: inactiveNode.id },
        actor.id,
        scopeFor(
          actor.id,
          organization.id,
          { code: 'complaints.assign', orgUnitId: null },
          { code: 'complaints.transfer', orgUnitId: null }
        )
      )
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 0 });

    // identical user + node again: no assignment audit event
    before = await auditCounts();
    const repeated = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: assignee.id, assigneeOrganizationId: secondOrgNode.id },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(repeated.assignedToUserId).toBe(assignee.id);
    expect(repeated.assignedToOrganizationId).toBe(secondOrgNode.id);
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 0 });

    // user removed while the node stays assigned: complaint.unassigned
    before = await auditCounts();
    const userRemoved = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeOrganizationId: secondOrgNode.id },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(userRemoved.assignedToUserId).toBeNull();
    expect(userRemoved.assignedToOrganizationId).toBe(secondOrgNode.id);
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 1 });

    // everything cleared: complaint.unassigned
    before = await auditCounts();
    const cleared = await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { reason: '  إعادة إلى الفرز المركزي  ' },
      actor.id,
      scopeFor(
        actor.id,
        organization.id,
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.transfer', orgUnitId: null }
      )
    );
    expect(cleared.assignedToUserId).toBeNull();
    expect(cleared.assignedToOrganizationId).toBeNull();
    expect(auditDelta(before, await auditCounts())).toEqual({ assigned: 0, reassigned: 0, unassigned: 1 });
    const centralTriageAudit = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, entity_id: complaintId, action: 'complaint.unassigned' },
      orderBy: { id: 'desc' },
    });
    expect(centralTriageAudit?.metadata).toMatchObject({ reason: 'إعادة إلى الفرز المركزي' });
  });

  it('returns tenant-scoped complaint summary aggregates', async () => {
    const before = await prisma.complaints.count({ where: { organization_id: organization.id } });
    const first = await complaintService.createComplaint(organization.id, makePayload(locations));
    const second = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { isSensitive: true, category: 'staff_behavior' })
    );
    const otherOrganization = await makeOrganization('report-other');
    await complaintService.createComplaint(otherOrganization.id, makePayload(locations));

    const report = await reportService.getComplaintSummary(organization.id);
    expect(report.summary.total).toBe(before + 2);
    expect(report.summary.unassigned).toBe(report.summary.total);
    expect(report.summary.sensitive).toBeGreaterThanOrEqual(1);
    expect(report.byStatus.find((entry) => entry.status === 'new').total).toBeGreaterThanOrEqual(2);
    expect(report.byCategory.find((entry) => entry.code === 'staff_behavior').total).toBeGreaterThanOrEqual(1);
    expect(report.byMonth.length).toBeGreaterThanOrEqual(1);
    expect(first.complaint.organizationId).toBe(organization.id);
    expect(second.complaint.organizationId).toBe(organization.id);
    expect(report.summary.total).not.toBe(before + 3);
  });

  it('tracks with the valid PIN and uses the same 404 for invalid PIN/reference', async () => {
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const tracked = await complaintService.trackComplaint(
      organization.id,
      created.complaint.referenceCode,
      created.trackingPin
    );
    expect(tracked).toMatchObject({
      referenceCode: created.complaint.referenceCode,
      status: 'new',
      statusLabel: 'تم استلام الشكوى',
    });
    expect(tracked).not.toHaveProperty('assignedTo');

    await expect(complaintService.trackComplaint(organization.id, created.complaint.referenceCode, '000000'))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(complaintService.trackComplaint(organization.id, 'CFMS-2099-000000', created.trackingPin))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('regenerates a tenant-scoped PIN, stores only its hash, and records an audit event', async () => {
    const actor = await makeUser('pin-regenerator');
    const otherOrganization = await makeOrganization('pin-regenerator-other');
    await prisma.organizations.update({
      where: { id: organization.id },
      data: { notification_settings: { whatsapp: { enabled: true, provider: 'custom', sendPin: true } } },
    });

    const created = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, { isAnonymous: false, fullName: 'PIN User', phone: '777555444' })
    );
    const foreign = await complaintService.createComplaint(
      otherOrganization.id,
      makePayload(locations, { isAnonymous: false, fullName: 'Foreign PIN User', phone: '777555445' })
    );
    const before = await prisma.complaints.findUnique({
      where: { id: created.complaint.id },
      select: { tracking_pin_hash: true },
    });

    const result = await complaintService.regenerateTrackingPin(
      organization.id,
      created.complaint.id,
      actor.id,
      scopeFor(actor.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
    );
    const updated = await prisma.complaints.findUnique({
      where: { id: created.complaint.id },
      select: { tracking_pin_hash: true, write_uid: true },
    });

    expect(result).toEqual({ channel: 'custom' });
    expect(result).not.toHaveProperty('trackingPin');
    expect(updated.tracking_pin_hash).not.toBe(before.tracking_pin_hash);
    expect(updated.tracking_pin_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(updated.write_uid).toBe(actor.id);
    expect(JSON.stringify(updated)).not.toContain(created.trackingPin);

    const audits = await prisma.audit_logs.findMany({
      where: {
        organization_id: organization.id,
        entity_id: created.complaint.id,
        action: 'complaint.tracking_pin_regenerated',
      },
    });
    expect(audits).toEqual([
      expect.objectContaining({
        actor_user_id: actor.id,
        metadata: { trackingPinReplaced: true },
      }),
    ]);
    expect(JSON.stringify(audits)).not.toContain(created.trackingPin);

    await expect(
      complaintService.regenerateTrackingPin(
        organization.id,
        foreign.complaint.id,
        actor.id,
        scopeFor(actor.id, organization.id, { code: 'complaints.assign', orgUnitId: null })
      )
    )
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
