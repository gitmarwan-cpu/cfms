'use strict';

require('./setup');

const prisma = require('../src/prisma/client');
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
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
};

const makeUser = async (suffix) => prisma.users.create({
  data: {
    full_name: `Complaint User ${suffix}`,
    email: `complaint-user-${suffix}-${Date.now()}@cfms.local`,
    password_hash: 'not-used-in-service-test',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
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
      String(user.id)
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

    await expect(
      complaintService.updateComplaintStatus(organization.id, String(created.complaint.id), 'closed', null, null)
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
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const created = await complaintService.createComplaint(organization.id, makePayload(locations));

    const assigned = await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: assignee.id },
      assignee.id
    );
    expect(assigned.assignedToUserId).toBe(assignee.id);
    expect(assigned.assignedToOrgUnitId).toBeNull();

    const unassigned = await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: null, assigneeOrgUnitId: null },
      assignee.id
    );
    expect(unassigned.assignedToUserId).toBeNull();
    expect(unassigned.assignedToOrgUnitId).toBeNull();
    await expect(
      prisma.audit_logs.findMany({ where: { organization_id: organization.id, entity_id: created.complaint.id, action: 'complaint.assigned' } })
    ).resolves.toHaveLength(1);
    await expect(
      prisma.audit_logs.findMany({ where: { organization_id: organization.id, entity_id: created.complaint.id, action: 'complaint.unassigned' } })
    ).resolves.toHaveLength(1);
  });

  it('assigns complaints to active tenant org units and rejects cross-tenant or inactive units', async () => {
    const actor = await makeUser('team-assigner');
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

    const unitType = await prisma.org_unit_types.create({
      data: {
        organization_id: organization.id,
        code: `team-${Date.now()}`,
        name_ar: 'فريق',
        name_en: 'Team',
        hierarchy_level: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const orgUnit = await prisma.org_units.create({
      data: {
        organization_id: organization.id,
        org_unit_type_id: unitType.id,
        name: 'Complaints Team',
        code: `CT-${Date.now()}`,
        manager_user_id: actor.id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const otherOrganization = await makeOrganization('team-other');
    const foreignUnitType = await prisma.org_unit_types.create({
      data: {
        organization_id: otherOrganization.id,
        code: `foreign-${Date.now()}`,
        name_ar: 'أجنبي',
        name_en: 'Foreign',
        hierarchy_level: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const foreignUnit = await prisma.org_units.create({
      data: {
        organization_id: otherOrganization.id,
        org_unit_type_id: foreignUnitType.id,
        name: 'Foreign Team',
        code: `FT-${Date.now()}`,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const inactiveUnit = await prisma.org_units.create({
      data: {
        organization_id: organization.id,
        org_unit_type_id: unitType.id,
        name: 'Inactive Team',
        code: `IT-${Date.now()}`,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const created = await complaintService.createComplaint(organization.id, makePayload(locations));
    const teamAssigned = await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeOrgUnitId: orgUnit.id },
      actor.id
    );
    expect(teamAssigned.assignedToOrgUnitId).toBe(orgUnit.id);
    expect(teamAssigned.assignedToUserId).toBeNull();
    expect(teamAssigned.assignedToOrgUnit).toMatchObject({ id: orgUnit.id, name: 'Complaints Team' });

    const assignee = await makeUser('team-member');
    await prisma.user_organizations.create({
      data: {
        user_id: assignee.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const bothAssigned = await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeUserId: assignee.id, assigneeOrgUnitId: orgUnit.id },
      actor.id
    );
    expect(bothAssigned.assignedToUserId).toBe(assignee.id);
    expect(bothAssigned.assignedToOrgUnitId).toBe(orgUnit.id);

    await expect(
      complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrgUnitId: foreignUnit.id },
        actor.id
      )
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrgUnitId: inactiveUnit.id },
        actor.id
      )
    ).rejects.toMatchObject({ statusCode: 422 });

    const cleared = await complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      {},
      actor.id
    );
    expect(cleared.assignedToUserId).toBeNull();
    expect(cleared.assignedToOrgUnitId).toBeNull();

    const assignedAudits = await prisma.audit_logs.findMany({
      where: { organization_id: organization.id, entity_id: created.complaint.id, action: 'complaint.assigned' },
      orderBy: { id: 'asc' },
    });
    expect(assignedAudits.length).toBeGreaterThanOrEqual(2);
    expect(assignedAudits.some((row) => row.metadata?.assigneeOrgUnitId === orgUnit.id)).toBe(true);

    await expect(
      prisma.notifications.findMany({
        where: {
          organization_id: organization.id,
          entity_id: created.complaint.id,
          notification_type: 'complaint.assigned',
          user_id: actor.id,
        },
      })
    ).resolves.toHaveLength(1);
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
});
