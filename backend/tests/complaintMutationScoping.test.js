'use strict';

require('./setup');

const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const slaService = require('../src/services/slaService.ts');

describe('GAP-07 / PADR-OPEN-05: Scope-Aware Authorization & Operational Boundaries', () => {
  let organization;
  let nodeA;
  let nodeB;
  let tenantAdminUser;
  let supervisorUser;
  let caseworkerUser;
  let nodeBUser;
  let locations;

  const makePayload = (locs, overrides = {}) => ({
    type: 'complaint',
    isAnonymous: true,
    governorateId: locs.governorateId,
    districtId: locs.districtId,
    category: 'service_quality',
    description: 'Detailed description for scoping tests with sufficient length',
    consentGiven: true,
    ...overrides,
  });

  beforeAll(async () => {
    const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
    const district = await prisma.districts.findFirst({
      where: { governorate_id: governorate.id, name_en: 'Yarim' },
    });
    locations = {
      governorateId: String(governorate.id),
      districtId: String(district.id),
    };

    // 1. Create Organization
    organization = await prisma.organizations.create({
      data: {
        legal_name: `Scoping Org ${Date.now()}`,
        slug: `scoping-org-${Date.now()}`,
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

    // 2. Create Org Nodes (Node A, Node B)
    nodeA = await prisma.organizations.create({
      data: {
        legal_name: `Branch Node A ${Date.now()}`,
        slug: `node-a-${Date.now()}`,
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
        root_organization_id: organization.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    nodeB = await prisma.organizations.create({
      data: {
        legal_name: `Branch Node B ${Date.now()}`,
        slug: `node-b-${Date.now()}`,
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
        root_organization_id: organization.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    // Find admin role
    const adminRole = await prisma.roles.findFirst({ where: { code: 'admin' } });

    // 3. Create Users
    tenantAdminUser = await prisma.users.create({
      data: {
        full_name: 'Tenant Admin',
        email: `tenant-admin-${Date.now()}@cfms.local`,
        password_hash: 'hash',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: tenantAdminUser.id,
        organization_id: organization.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    if (adminRole) {
      await prisma.user_roles.create({
        data: {
          user_id: tenantAdminUser.id,
          role_id: adminRole.id,
          organization_id: organization.id,
          organization_node_id: null,
          create_date: new Date(),
          write_date: new Date(),
        },
      });
    }

    supervisorUser = await prisma.users.create({
      data: {
        full_name: 'Delegated Supervisor Node A',
        email: `supervisor-${Date.now()}@cfms.local`,
        password_hash: 'hash',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: supervisorUser.id,
        organization_id: organization.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    caseworkerUser = await prisma.users.create({
      data: {
        full_name: 'Caseworker Node A',
        email: `caseworker-${Date.now()}@cfms.local`,
        password_hash: 'hash',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: caseworkerUser.id,
        organization_id: organization.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    nodeBUser = await prisma.users.create({
      data: {
        full_name: 'User Node B',
        email: `nodeb-${Date.now()}@cfms.local`,
        password_hash: 'hash',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: nodeBUser.id,
        organization_id: organization.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
  });

  // Actor Scopes Fixtures
  const tenantAdminScope = () => ({
    userId: tenantAdminUser.id,
    tenantId: organization.id,
    grants: [
      { code: 'complaints.assign', orgUnitId: null },
      { code: 'complaints.transfer', orgUnitId: null },
      { code: 'complaints.escalate', orgUnitId: null },
      { code: 'complaints.close', orgUnitId: null },
    ],
  });

  // Delegated supervisor: has complaints.transfer and complaints.escalate on Node A, but NOT complaints.assign
  const supervisorScope = () => ({
    userId: supervisorUser.id,
    tenantId: organization.id,
    grants: [
      { code: 'complaints.transfer', orgUnitId: nodeA.id },
      { code: 'complaints.escalate', orgUnitId: nodeA.id },
    ],
  });

  // Caseworker: has complaints.assign on Node A, but NOT complaints.transfer
  const caseworkerScope = () => ({
    userId: caseworkerUser.id,
    tenantId: organization.id,
    grants: [
      { code: 'complaints.assign', orgUnitId: nodeA.id },
    ],
  });

  // Node B user: has complaints.transfer and complaints.assign on Node B only
  const nodeBScope = () => ({
    userId: nodeBUser.id,
    tenantId: organization.id,
    grants: [
      { code: 'complaints.assign', orgUnitId: nodeB.id },
      { code: 'complaints.transfer', orgUnitId: nodeB.id },
      { code: 'complaints.escalate', orgUnitId: nodeB.id },
    ],
  });

  const foreignTenantScope = (grants) => ({
    userId: tenantAdminUser.id,
    tenantId: organization.id + 1000000,
    grants,
  });

  const createComplaintOnNodeA = async (overrides = {}) => {
    const created = await complaintService.createComplaint(
      organization.id,
      makePayload(locations, overrides)
    );
    return complaintService.assignComplaint(
      organization.id,
      created.complaint.id,
      { assigneeOrganizationId: nodeA.id },
      tenantAdminUser.id,
      tenantAdminScope()
    );
  };

  describe('Service-level tenant scope invariant', () => {
    it('rejects mismatched tenant scope for transitions with 403 and no transition data', async () => {
      const complaint = await createComplaintOnNodeA();

      await expect(
        complaintService.getComplaintTransitions(
          organization.id,
          complaint.id,
          foreignTenantScope([{ code: 'complaints.assign', orgUnitId: null }])
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects mismatched tenant scope for assignment before changing assignment or audit history', async () => {
      const complaint = await createComplaintOnNodeA();
      const before = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { assigned_to_user_id: true, assigned_to_organization_id: true },
      });
      const auditBefore = await prisma.audit_logs.count({
        where: {
          organization_id: organization.id,
          entity_type: 'complaint',
          entity_id: complaint.id,
          action: { in: ['complaint.assigned', 'complaint.reassigned', 'complaint.unassigned'] },
        },
      });

      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaint.id,
          { assigneeOrganizationId: nodeB.id },
          tenantAdminUser.id,
          foreignTenantScope([{ code: 'complaints.assign', orgUnitId: null }])
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      const after = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { assigned_to_user_id: true, assigned_to_organization_id: true },
      });
      const auditAfter = await prisma.audit_logs.count({
        where: {
          organization_id: organization.id,
          entity_type: 'complaint',
          entity_id: complaint.id,
          action: { in: ['complaint.assigned', 'complaint.reassigned', 'complaint.unassigned'] },
        },
      });

      expect(after).toEqual(before);
      expect(auditAfter).toBe(auditBefore);
    });

    it('rejects mismatched tenant scope for status changes and closing before mutation', async () => {
      const complaint = await createComplaintOnNodeA();
      const foreignScope = foreignTenantScope([
        { code: 'complaints.assign', orgUnitId: null },
        { code: 'complaints.close', orgUnitId: null },
      ]);

      const beforeStatus = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { status: true },
      });
      const beforeHistory = await prisma.complaint_status_history.count({
        where: { complaint_id: complaint.id },
      });

      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          complaint.id,
          'in_review',
          'رفض بنطاق مؤسسة مختلف',
          tenantAdminUser.id,
          foreignScope
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(
        await prisma.complaints.findUnique({ where: { id: complaint.id }, select: { status: true } })
      ).toEqual(beforeStatus);
      expect(await prisma.complaint_status_history.count({ where: { complaint_id: complaint.id } })).toBe(
        beforeHistory
      );

      await complaintService.updateComplaintStatus(
        organization.id,
        complaint.id,
        'in_review',
        'بدء المراجعة',
        tenantAdminUser.id,
        tenantAdminScope()
      );
      await complaintService.updateComplaintStatus(
        organization.id,
        complaint.id,
        'resolved',
        'تم الحل',
        tenantAdminUser.id,
        tenantAdminScope()
      );

      const beforeCloseHistory = await prisma.complaint_status_history.count({
        where: { complaint_id: complaint.id },
      });
      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          complaint.id,
          'closed',
          'محاولة إغلاق بنطاق مؤسسة مختلف',
          tenantAdminUser.id,
          foreignScope
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(
        await prisma.complaints.findUnique({ where: { id: complaint.id }, select: { status: true } })
      ).toEqual({ status: 'resolved' });
      expect(await prisma.complaint_status_history.count({ where: { complaint_id: complaint.id } })).toBe(
        beforeCloseHistory
      );
    });

    it('rejects missing and malformed scopes for assignment before any mutation', async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      const before = await prisma.complaints.findUnique({
        where: { id: created.complaint.id },
        select: { assigned_to_user_id: true, assigned_to_organization_id: true },
      });

      for (const scope of [
        undefined,
        null,
        'not-a-scope',
        { userId: tenantAdminUser.id, tenantId: 0, grants: [] },
        { userId: tenantAdminUser.id, tenantId: organization.id, grants: null },
      ]) {
        await expect(
          complaintService.assignComplaint(
            organization.id,
            created.complaint.id,
            { assigneeOrganizationId: nodeA.id },
            tenantAdminUser.id,
            scope
          )
        ).rejects.toMatchObject({ statusCode: 403 });
      }

      expect(
        await prisma.complaints.findUnique({
          where: { id: created.complaint.id },
          select: { assigned_to_user_id: true, assigned_to_organization_id: true },
        })
      ).toEqual(before);
    });

    it('rejects mismatched tenant scope for tracking PIN regeneration before changing the PIN or audit history', async () => {
      const complaint = await createComplaintOnNodeA({
        isAnonymous: false,
        fullName: 'Tenant Scope PIN Test',
        phone: '+967700000001',
      });
      const before = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { tracking_pin_hash: true },
      });
      const auditBefore = await prisma.audit_logs.count({
        where: {
          organization_id: organization.id,
          entity_type: 'complaint',
          entity_id: complaint.id,
          action: 'complaint.tracking_pin_regenerated',
        },
      });

      await expect(
        complaintService.regenerateTrackingPin(
          organization.id,
          complaint.id,
          tenantAdminUser.id,
          foreignTenantScope([{ code: 'complaints.assign', orgUnitId: null }])
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(
        await prisma.complaints.findUnique({ where: { id: complaint.id }, select: { tracking_pin_hash: true } })
      ).toEqual(before);
      expect(
        await prisma.audit_logs.count({
          where: {
            organization_id: organization.id,
            entity_type: 'complaint',
            entity_id: complaint.id,
            action: 'complaint.tracking_pin_regenerated',
          },
        })
      ).toBe(auditBefore);
    });

    it('allows valid same-tenant node-scoped PIN regeneration', async () => {
      await prisma.organizations.update({
        where: { id: organization.id },
        data: { notification_settings: { whatsapp: { enabled: true, provider: 'custom' } } },
      });
      const complaint = await createComplaintOnNodeA({
        isAnonymous: false,
        fullName: 'Same Tenant PIN Test',
        phone: '+967700000002',
      });
      const before = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { tracking_pin_hash: true },
      });

      const result = await complaintService.regenerateTrackingPin(
        organization.id,
        complaint.id,
        caseworkerUser.id,
        caseworkerScope()
      );

      const after = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { tracking_pin_hash: true },
      });
      expect(result).toMatchObject({ channel: 'custom' });
      expect(after.tracking_pin_hash).not.toBe(before.tracking_pin_hash);
    });

    it('rejects mismatched tenant scope for manual SLA escalation before changing level or escalation events', async () => {
      const complaint = await createComplaintOnNodeA();
      const before = await prisma.complaints.findUnique({
        where: { id: complaint.id },
        select: { escalation_level: true },
      });
      const eventsBefore = await prisma.complaint_escalation_events.count({
        where: { complaint_id: complaint.id },
      });

      await expect(
        slaService.escalateComplaint(
          organization.id,
          complaint.id,
          { note: 'محاولة تصعيد بنطاق مؤسسة مختلف' },
          tenantAdminUser.id,
          foreignTenantScope([{ code: 'complaints.escalate', orgUnitId: null }])
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(
        await prisma.complaints.findUnique({ where: { id: complaint.id }, select: { escalation_level: true } })
      ).toEqual(before);
      expect(await prisma.complaint_escalation_events.count({ where: { complaint_id: complaint.id } })).toBe(
        eventsBefore
      );
    });
  });

  describe('Unassigned Complaint (Central Triage) Routing', () => {
    it('allows tenant-wide complaints.assign to route unassigned complaint to Node A', async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      expect(created.complaint.assignedToOrganizationId).toBeNull();

      const assigned = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
      expect(assigned.assignedToOrganizationId).toBe(nodeA.id);
    });

    it('hides unassigned complaint (throws 404) from node-scoped actor without tenant-wide assign', async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      expect(created.complaint.assignedToOrganizationId).toBeNull();

      // Node A caseworker cannot access unassigned Central Triage complaint
      await expect(
        complaintService.assignComplaint(
          organization.id,
          created.complaint.id,
          { assigneeOrganizationId: nodeA.id },
          caseworkerUser.id,
          caseworkerScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      // Node A supervisor cannot access unassigned Central Triage complaint
      await expect(
        complaintService.assignComplaint(
          organization.id,
          created.complaint.id,
          { assigneeOrganizationId: nodeA.id },
          supervisorUser.id,
          supervisorScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Intra-Node Assignment (Node A -> Node A)', () => {
    let complaintOnNodeA;

    beforeEach(async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      complaintOnNodeA = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
    });

    it('allows node caseworker with complaints.assign on Node A to assign to user in Node A', async () => {
      const result = await complaintService.assignComplaint(
        organization.id,
        complaintOnNodeA.id,
        { assigneeUserId: caseworkerUser.id, assigneeOrganizationId: nodeA.id },
        caseworkerUser.id,
        caseworkerScope()
      );
      expect(result.assignedToUserId).toBe(caseworkerUser.id);
      expect(result.assignedToOrganizationId).toBe(nodeA.id);
    });

    it('rejects intra-node reassignment with 403 when actor has complaints.transfer but lacks complaints.assign', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeUserId: caseworkerUser.id, assigneeOrganizationId: nodeA.id },
          supervisorUser.id,
          supervisorScope()
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('hides complaint on Node A with 404 from actor scoped only to Node B', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: nodeA.id },
          nodeBUser.id,
          nodeBScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Cross-Node Transfer (Node A -> Node B)', () => {
    let complaintOnNodeA;

    beforeEach(async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      complaintOnNodeA = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
    });

    it('allows actor with complaints.transfer on Node A to transfer to Node B without mandatory reason', async () => {
      const result = await complaintService.assignComplaint(
        organization.id,
        complaintOnNodeA.id,
        { assigneeOrganizationId: nodeB.id },
        supervisorUser.id,
        supervisorScope()
      );
      expect(result.assignedToOrganizationId).toBe(nodeB.id);
      expect(result.assignedToUserId).toBeNull();
    });

    it('allows tenant-wide complaints.assign to transfer across nodes', async () => {
      const result = await complaintService.assignComplaint(
        organization.id,
        complaintOnNodeA.id,
        { assigneeOrganizationId: nodeB.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
      expect(result.assignedToOrganizationId).toBe(nodeB.id);
    });

    it('rejects cross-node transfer with 403 when actor has complaints.assign on Node A but lacks complaints.transfer', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: nodeB.id },
          caseworkerUser.id,
          caseworkerScope()
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('hides complaint on Node A with 404 from actor who only has complaints.transfer on destination Node B', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: nodeB.id },
          nodeBUser.id,
          nodeBScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Policy 4B: Return to Central Triage (Node A -> Central Triage)', () => {
    let complaintOnNodeA;

    beforeEach(async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      complaintOnNodeA = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
    });

    it('rejects return to Central Triage with 422 if reason is missing or empty', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: null, assigneeUserId: null },
          supervisorUser.id,
          supervisorScope()
        )
      ).rejects.toMatchObject({ statusCode: 422 });

      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: null, assigneeUserId: null, reason: '   ' },
          supervisorUser.id,
          supervisorScope()
        )
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('allows Delegated Supervisor with complaints.transfer on Node A to return to Central Triage with reason', async () => {
      const returnReason = 'خارج اختصاص الوحدة التنظيمية أ';
      const result = await complaintService.assignComplaint(
        organization.id,
        complaintOnNodeA.id,
        { assigneeOrganizationId: null, assigneeUserId: null, reason: returnReason },
        supervisorUser.id,
        supervisorScope()
      );
      expect(result.assignedToOrganizationId).toBeNull();
      expect(result.assignedToUserId).toBeNull();

      // Verify audit log metadata
      const audit = await prisma.audit_logs.findFirst({
        where: {
          organization_id: organization.id,
          entity_id: complaintOnNodeA.id,
          action: 'complaint.unassigned',
        },
        orderBy: { id: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit.metadata).toMatchObject({
        reason: returnReason,
        previousAssigneeOrganizationId: nodeA.id,
      });

      // Verify in-app notification to Central Triage tenant admins
      const notifs = await prisma.notifications.findMany({
        where: {
          organization_id: organization.id,
          entity_id: complaintOnNodeA.id,
          notification_type: 'complaint.assigned',
          user_id: tenantAdminUser.id,
        },
      });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
      expect(notifs[0].title).toBe('إعادة شكوى إلى فرز الشكاوى المركزي');
    });

    it('allows tenant-wide complaints.assign to return to Central Triage with reason', async () => {
      const returnReason = 'إعادة للتوزيع بواسطة مدير النظام';
      const result = await complaintService.assignComplaint(
        organization.id,
        complaintOnNodeA.id,
        { assigneeOrganizationId: null, reason: returnReason },
        tenantAdminUser.id,
        tenantAdminScope()
      );
      expect(result.assignedToOrganizationId).toBeNull();
    });

    it('rejects return to Central Triage with 403 when actor has complaints.assign on Node A but lacks transfer or tenant-wide assign', async () => {
      await expect(
        complaintService.assignComplaint(
          organization.id,
          complaintOnNodeA.id,
          { assigneeOrganizationId: null, reason: 'محاولة إعادة' },
          caseworkerUser.id,
          caseworkerScope()
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('Status Transitions & Closing Operational Authority', () => {
    let complaintOnNodeA;

    beforeEach(async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      complaintOnNodeA = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
    });

    it('rejects status change with 404 when actor is out of scope for Node A', async () => {
      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          String(complaintOnNodeA.id),
          'in_review',
          'Review note',
          nodeBUser.id,
          nodeBScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('allows in-scope actor with operational authority (complaints.assign) to update status to in_review', async () => {
      const updated = await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'in_review',
        'بدء المراجعة',
        caseworkerUser.id,
        caseworkerScope()
      );
      expect(updated.status).toBe('in_review');
    });

    it('rejects closing with 403 when actor lacks complaints.close', async () => {
      // Move to in_review first
      await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'in_review',
        'بدء المراجعة',
        tenantAdminUser.id,
        tenantAdminScope()
      );
      // Move to resolved
      await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'resolved',
        'تم الحل',
        tenantAdminUser.id,
        tenantAdminScope()
      );

      // Caseworker has complaints.assign but lacks complaints.close
      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          String(complaintOnNodeA.id),
          'closed',
          'محاولة إغلاق',
          caseworkerUser.id,
          caseworkerScope()
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows closing when actor holds complaints.close', async () => {
      // Step through valid workflow transitions to resolved
      await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'in_review',
        'بدء المراجعة',
        tenantAdminUser.id,
        tenantAdminScope()
      );
      await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'resolved',
        'تم الحل',
        tenantAdminUser.id,
        tenantAdminScope()
      );

      // Tenant admin has complaints.close
      const closed = await complaintService.updateComplaintStatus(
        organization.id,
        String(complaintOnNodeA.id),
        'closed',
        'إغلاق نهائي',
        tenantAdminUser.id,
        tenantAdminScope()
      );
      expect(closed.status).toBe('closed');
    });
  });

  describe('Manual Escalation Scoping', () => {
    let complaintOnNodeA;

    beforeEach(async () => {
      const created = await complaintService.createComplaint(organization.id, makePayload(locations));
      complaintOnNodeA = await complaintService.assignComplaint(
        organization.id,
        created.complaint.id,
        { assigneeOrganizationId: nodeA.id },
        tenantAdminUser.id,
        tenantAdminScope()
      );
    });

    it('allows actor with complaints.escalate on Node A to escalate manually', async () => {
      const result = await slaService.escalateComplaint(
        organization.id,
        complaintOnNodeA.id,
        { reason: 'تأخير غير مبرر' },
        supervisorUser.id,
        supervisorScope()
      );
      expect(result).toMatchObject({
        id: complaintOnNodeA.id,
        escalationLevel: 1,
      });
    });

    it('rejects manual escalation with 404 when actor is out of scope (Node B actor on Node A complaint)', async () => {
      await expect(
        slaService.escalateComplaint(
          organization.id,
          complaintOnNodeA.id,
          { reason: 'محاولة تصعيد من خارج النطاق' },
          nodeBUser.id,
          nodeBScope()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
