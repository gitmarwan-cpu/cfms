'use strict';

require('./setup');

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { default: app } = require('../src/app');
const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const {
  createOrganization,
  createUserWithRole,
  getSeedGovernorateId,
} = require('./setup');

/**
 * ============================================================
 * Complaint read visibility (Stage 9 — read-side node scoping)
 * ============================================================
 * Fixed semantics under test:
 *   - `complaints.view_all` (no node)         → every complaint of the active tenant.
 *   - `complaints.view_all` with node scope N → only complaints assigned to node N
 *                                               (exact node, no subtree traversal).
 *   - `complaints.view_own`                   → only complaints assigned directly to the
 *                                               authenticated user.
 *   - unassigned complaints                   → visible to `view_all` only.
 *   - list and detail share the same predicate; out-of-scope detail access is 404
 *     (never 403) to preserve the existence-hiding contract.
 *   - scope comes from trusted RBAC data only; query/body/params/headers can never expand it.
 */
describe('Complaint read visibility (organization node scoping)', () => {
  let organization;
  let otherOrganization;
  let adminToken;
  let otherAdminToken;
  let nodeA;
  let nodeB;
  let ownUserId;
  let otherAssigneeUserId;
  let nodeAUserToken;
  let nodeBUserToken;
  let ownUserToken;
  let combinedUserToken;
  let assignOnlyToken;
  let complaintNodeA;
  let complaintNodeB;
  let complaintOwn;
  let complaintOtherAssignee;
  let complaintUnassigned;
  let complaintCombinedOwn;
  let attachmentNodeA;
  let attachmentNodeB;
  let attachmentOwn;
  let districtId;
  const writtenFiles = [];

  const login = async (email) => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123' });
    expect(response.status).toBe(200);
    return response.body.data.token;
  };

  const makeRolelessUser = async (label) => {
    const { user } = await createUserWithRole(
      {
        fullName: `Visibility ${label}`,
        email: `visibility.${label}.${Math.random().toString(36).slice(2, 8)}@cfms.local`,
        roleCode: 'staff',
        organizationId: organization.id,
      },
      'Password123'
    );
    // Drop the default `staff` (complaints.view_own) grant so each fixture user holds
    // exactly the role assignments asserted by the tests.
    await prisma.user_roles.deleteMany({ where: { user_id: user.id } });
    return user;
  };

  const createRoleWithPermissions = async (code, permissionCodes) => {
    const permissions = await prisma.permissions.findMany({ where: { code: { in: permissionCodes } } });
    expect(permissions.map((permission) => permission.code).sort()).toEqual([...permissionCodes].sort());
    const response = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code, nameAr: `دور ${code}`, permissionIds: permissions.map((permission) => permission.id) });
    expect(response.status).toBe(201);
    return response.body.data.id;
  };

  const assignRole = async (userId, roleId, organizationNodeId = null) => {
    const response = await request(app)
      .post(`/api/users/${userId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId, organizationNodeId });
    expect(response.status).toBe(201);
  };

  const createComplaint = async (description) => {
    const result = await complaintService.createComplaint(organization.id, {
      type: 'complaint',
      isAnonymous: true,
      governorateId: String(getSeedGovernorateId()),
      districtId: String(districtId),
      category: 'service_quality',
      description,
      consentGiven: true,
    });
    return result.complaint;
  };

  const assignComplaint = async (complaintId, { assigneeUserId = null, assigneeOrganizationId = null }) => {
    const response = await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeUserId, assigneeOrganizationId });
    expect(response.status).toBe(200);
  };

  const listIds = async (token, query = '', extraHeaders = {}) => {
    let pending = request(app)
      .get(`/api/complaints${query}`)
      .set('Authorization', `Bearer ${token}`);
    pending = Object.entries(extraHeaders).reduce(
      (chain, [header, value]) => chain.set(header, value),
      pending
    );
    const response = await pending;
    expect(response.status).toBe(200);
    return response.body.data.map((row) => row.id);
  };

  const detailStatus = async (token, complaintId, query = '', extraHeaders = {}) => {
    let pending = request(app)
      .get(`/api/complaints/${complaintId}${query}`)
      .set('Authorization', `Bearer ${token}`);
    pending = Object.entries(extraHeaders).reduce(
      (chain, [header, value]) => chain.set(header, value),
      pending
    );
    return (await pending).status;
  };

  beforeAll(async () => {
    const governorateId = getSeedGovernorateId();
    const district = await prisma.districts.findFirst({ where: { governorate_id: governorateId } });
    districtId = district.id;

    organization = await createOrganization({
      legalName: 'مؤسسة رؤية الشكاوى',
      slug: `visibility-org-${Date.now()}`,
    });
    otherOrganization = await createOrganization({
      legalName: 'مؤسسة رؤية أخرى',
      slug: `visibility-other-org-${Date.now()}`,
    });

    const { user: adminUser } = await createUserWithRole(
      {
        fullName: 'Visibility Admin',
        email: `visibility.admin.${Date.now()}@cfms.local`,
        roleCode: 'admin',
        organizationId: organization.id,
      },
      'Password123'
    );
    const { user: otherAdminUser } = await createUserWithRole(
      {
        fullName: 'Visibility Other Admin',
        email: `visibility.other.admin.${Date.now()}@cfms.local`,
        roleCode: 'admin',
        organizationId: otherOrganization.id,
      },
      'Password123'
    );
    adminToken = await login(adminUser.email);
    otherAdminToken = await login(otherAdminUser.email);

    const typeResponse = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `visibility_node_${Date.now()}`, nameAr: 'وحدة الرؤية', hierarchyLevel: 1 });
    expect(typeResponse.status).toBe(201);

    const createNode = async (name) => {
      const response = await request(app)
        .post('/api/organization/nodes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, orgUnitTypeId: typeResponse.body.data.id });
      expect(response.status).toBe(201);
      return response.body.data.id;
    };
    nodeA = await createNode('وحدة أ');
    nodeB = await createNode('وحدة ب');

    const nodeAUser = await makeRolelessUser('node-a');
    const nodeBUser = await makeRolelessUser('node-b');
    const ownUser = await makeRolelessUser('own');
    const combinedUser = await makeRolelessUser('combined');
    const otherAssignee = await makeRolelessUser('other-assignee');
    const assignOnlyUser = await makeRolelessUser('assign-only');
    ownUserId = ownUser.id;
    otherAssigneeUserId = otherAssignee.id;

    const nodeReadRoleId = await createRoleWithPermissions(`vis_node_read_${Date.now()}`, ['complaints.view_all']);
    const ownReadRoleId = await createRoleWithPermissions(`vis_own_read_${Date.now()}`, ['complaints.view_own']);
    const assignOnlyRoleId = await createRoleWithPermissions(`vis_assign_${Date.now()}`, ['complaints.assign']);

    await assignRole(nodeAUser.id, nodeReadRoleId, nodeA);
    await assignRole(nodeBUser.id, nodeReadRoleId, nodeB);
    await assignRole(ownUser.id, ownReadRoleId);
    await assignRole(combinedUser.id, ownReadRoleId);
    await assignRole(combinedUser.id, nodeReadRoleId, nodeA);
    await assignRole(assignOnlyUser.id, assignOnlyRoleId);

    nodeAUserToken = await login(nodeAUser.email);
    nodeBUserToken = await login(nodeBUser.email);
    ownUserToken = await login(ownUser.email);
    combinedUserToken = await login(combinedUser.email);
    assignOnlyToken = await login(assignOnlyUser.email);

    complaintNodeA = await createComplaint('شكوى مسندة إلى وحدة أ لاختبار نطاق الرؤية التنظيمية');
    complaintNodeB = await createComplaint('شكوى مسندة إلى وحدة ب لاختبار نطاق الرؤية التنظيمية');
    complaintOwn = await createComplaint('شكوى مسندة إلى المستخدم نفسه لاختبار نطاق الملكية');
    complaintOtherAssignee = await createComplaint('شكوى مسندة إلى مستخدم آخر لاختبار نطاق الملكية');
    complaintUnassigned = await createComplaint('شكوى غير مسندة لاختبار عدم ظهورها ضمن النطاقات المقيّدة');
    complaintCombinedOwn = await createComplaint('شكوى مسندة إلى المستخدم الجامع بين نطاق عقدة ونطاق الملكية');

    await assignComplaint(complaintNodeA.id, { assigneeOrganizationId: nodeA });
    await assignComplaint(complaintNodeB.id, { assigneeOrganizationId: nodeB });
    await assignComplaint(complaintOwn.id, { assigneeUserId: ownUserId });
    await assignComplaint(complaintOtherAssignee.id, { assigneeUserId: otherAssigneeUserId });
    await assignComplaint(complaintCombinedOwn.id, { assigneeUserId: combinedUser.id });

    const uploadRoot = path.resolve(process.env.CFMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    fs.mkdirSync(uploadRoot, { recursive: true });
    const makeAttachment = async (complaintId, name) => {
      const content = Buffer.from('%PDF-1.4\nCFMS visibility test\n');
      const storedFileName = `visibility-${name}-${Date.now()}.pdf`;
      const filePath = path.join(uploadRoot, storedFileName);
      fs.writeFileSync(filePath, content);
      writtenFiles.push(filePath);
      return prisma.complaint_attachments.create({
        data: {
          complaint_id: complaintId,
          original_name: `${name}.pdf`,
          stored_file_name: storedFileName,
          mime_type: 'application/pdf',
          size_bytes: content.length,
          create_date: new Date(),
          write_date: new Date(),
        },
      });
    };
    attachmentNodeA = await makeAttachment(complaintNodeA.id, 'node-a');
    attachmentNodeB = await makeAttachment(complaintNodeB.id, 'node-b');
    attachmentOwn = await makeAttachment(complaintOwn.id, 'own');
  });

  afterAll(() => {
    for (const filePath of writtenFiles) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // best-effort cleanup only
      }
    }
  });

  it('view_all sees every complaint of the tenant, including unassigned ones', async () => {
    const ids = await listIds(adminToken);
    expect(ids).toEqual(
      expect.arrayContaining([
        complaintNodeA.id,
        complaintNodeB.id,
        complaintOwn.id,
        complaintOtherAssignee.id,
        complaintUnassigned.id,
        complaintCombinedOwn.id,
      ])
    );
    expect(await detailStatus(adminToken, complaintNodeB.id)).toBe(200);
    expect(await detailStatus(adminToken, complaintUnassigned.id)).toBe(200);
  });

  it('a node-scoped user sees complaints assigned to their own node', async () => {
    expect(await listIds(nodeAUserToken)).toContain(complaintNodeA.id);
    expect(await detailStatus(nodeAUserToken, complaintNodeA.id)).toBe(200);
  });

  it('a node-scoped user does not see a complaint assigned to a sibling node', async () => {
    expect(await listIds(nodeAUserToken)).not.toContain(complaintNodeB.id);

    const nodeBIds = await listIds(nodeBUserToken);
    expect(nodeBIds).toContain(complaintNodeB.id);
    expect(nodeBIds).not.toContain(complaintNodeA.id);
  });

  it('a node-scoped user does not see unassigned complaints', async () => {
    expect(await listIds(nodeAUserToken)).not.toContain(complaintUnassigned.id);
    expect(await detailStatus(nodeAUserToken, complaintUnassigned.id)).toBe(404);
  });

  it('an out-of-scope complaint ID returns 404 (not 403) for a node-scoped user', async () => {
    expect(await detailStatus(nodeAUserToken, complaintNodeB.id)).toBe(404);
    expect(await detailStatus(nodeAUserToken, complaintOwn.id)).toBe(404);
    expect(await detailStatus(nodeAUserToken, complaintOtherAssignee.id)).toBe(404);
  });

  it('view_own sees complaints assigned directly to the authenticated user', async () => {
    expect(await listIds(ownUserToken)).toContain(complaintOwn.id);
    expect(await detailStatus(ownUserToken, complaintOwn.id)).toBe(200);
  });

  it('view_own does not see complaints assigned to another user or to a node', async () => {
    const ids = await listIds(ownUserToken);
    expect(ids).not.toContain(complaintOtherAssignee.id);
    expect(ids).not.toContain(complaintNodeA.id);
    expect(await detailStatus(ownUserToken, complaintOtherAssignee.id)).toBe(404);
  });

  it('view_own does not see unassigned complaints', async () => {
    expect(await listIds(ownUserToken)).not.toContain(complaintUnassigned.id);
    expect(await detailStatus(ownUserToken, complaintUnassigned.id)).toBe(404);
  });

  it('a user with node scope and view_own sees the union of both scopes', async () => {
    const ids = await listIds(combinedUserToken);
    expect(ids).toContain(complaintNodeA.id);
    expect(ids).toContain(complaintCombinedOwn.id);
    expect(ids).not.toContain(complaintNodeB.id);
    expect(ids).not.toContain(complaintOtherAssignee.id);
    expect(ids).not.toContain(complaintUnassigned.id);
  });

  it('view_all overrides node and ownership restrictions', async () => {
    const ids = await listIds(adminToken);
    const fixtures = [complaintNodeA, complaintNodeB, complaintOwn, complaintOtherAssignee, complaintUnassigned];
    for (const complaint of fixtures) {
      expect(ids).toContain(complaint.id);
      expect(await detailStatus(adminToken, complaint.id)).toBe(200);
    }
  });

  it('rejects a caller without any complaint read permission', async () => {
    const listResponse = await request(app)
      .get('/api/complaints')
      .set('Authorization', `Bearer ${assignOnlyToken}`);
    expect(listResponse.status).toBe(403);

    const detailResponse = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}`)
      .set('Authorization', `Bearer ${assignOnlyToken}`);
    expect(detailResponse.status).toBe(403);
  });

  it('keeps cross-tenant complaint isolation (404, never a leak)', async () => {
    const ids = await listIds(otherAdminToken);
    const fixtures = [complaintNodeA, complaintNodeB, complaintOwn, complaintOtherAssignee, complaintUnassigned];
    for (const complaint of fixtures) {
      expect(ids).not.toContain(complaint.id);
      expect(await detailStatus(otherAdminToken, complaint.id)).toBe(404);
    }
  });

  it('keeps list/detail scope parity for every read scope', async () => {
    const actors = [adminToken, nodeAUserToken, nodeBUserToken, ownUserToken, combinedUserToken];
    const fixtures = [complaintNodeA, complaintNodeB, complaintOwn, complaintOtherAssignee, complaintUnassigned, complaintCombinedOwn];
    for (const token of actors) {
      const ids = await listIds(token);
      for (const complaint of fixtures) {
        const expectedStatus = ids.includes(complaint.id) ? 200 : 404;
        expect(await detailStatus(token, complaint.id)).toBe(expectedStatus);
      }
    }
  });

  it('cannot bypass complaint visibility through the attachment endpoint', async () => {
    const nodeScopedOutOfScope = await request(app)
      .get(`/api/complaints/${complaintNodeB.id}/attachments/${attachmentNodeB.id}`)
      .set('Authorization', `Bearer ${nodeAUserToken}`);
    expect(nodeScopedOutOfScope.status).toBe(404);

    const nodeScopedInScope = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/attachments/${attachmentNodeA.id}`)
      .set('Authorization', `Bearer ${nodeAUserToken}`);
    expect(nodeScopedInScope.status).toBe(200);

    // An own-scoped caller cannot access attachments on complaints outside their assignment (404)
    const ownScopedOutOfScope = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/attachments/${attachmentNodeA.id}`)
      .set('Authorization', `Bearer ${ownUserToken}`);
    expect(ownScopedOutOfScope.status).toBe(404);

    // An own-scoped caller can access attachments on complaints assigned to them (200)
    const ownScopedInScope = await request(app)
      .get(`/api/complaints/${complaintOwn.id}/attachments/${attachmentOwn.id}`)
      .set('Authorization', `Bearer ${ownUserToken}`);
    expect(ownScopedInScope.status).toBe(200);

    // A caller without any complaint read permission is rejected at the route gate (403)
    const withoutRead = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/attachments/${attachmentNodeA.id}`)
      .set('Authorization', `Bearer ${assignOnlyToken}`);
    expect(withoutRead.status).toBe(403);

    const tenantWide = await request(app)
      .get(`/api/complaints/${complaintNodeB.id}/attachments/${attachmentNodeB.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(tenantWide.status).toBe(200);
  });

  it('keeps transitions a workflow endpoint (complaints.assign, tenant scoped)', async () => {
    // Frozen by Stage 6 and docs/API_CONVENTIONS.md: transitions returns workflow truth to
    // `complaints.assign` holders and is intentionally not filtered by read visibility.
    // Node scoping of workflow/mutation paths is a documented future concern (not Stage 9).
    const assignHolder = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/transitions`)
      .set('Authorization', `Bearer ${assignOnlyToken}`);
    expect(assignHolder.status).toBe(200);

    const withoutAssign = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/transitions`)
      .set('Authorization', `Bearer ${nodeAUserToken}`);
    expect(withoutAssign.status).toBe(403);

    const crossTenant = await request(app)
      .get(`/api/complaints/${complaintNodeA.id}/transitions`)
      .set('Authorization', `Bearer ${otherAdminToken}`);
    expect(crossTenant.status).toBe(404);
  });

  it('cannot expand scope with a client-supplied node id (query, header or body)', async () => {
    const hostileQueries = [
      `?assignedToOrganizationId=${nodeB}`,
      `?assigneeOrganizationId=${nodeB}`,
      `?organizationNodeId=${nodeB}`,
      `?nodeId=${nodeB}`,
      `?organizationId=${nodeB}`,
    ];
    for (const query of hostileQueries) {
      const ids = await listIds(nodeAUserToken, query);
      expect(ids).toContain(complaintNodeA.id);
      expect(ids).not.toContain(complaintNodeB.id);
      expect(ids).not.toContain(complaintUnassigned.id);
    }

    const hostileHeaders = {
      'X-Organization-Node-Id': String(nodeB),
      'X-Organization-Node': String(nodeB),
      'X-Node-Id': String(nodeB),
    };
    expect(await listIds(nodeAUserToken, '', hostileHeaders)).not.toContain(complaintNodeB.id);
    expect(await detailStatus(nodeAUserToken, complaintNodeB.id, `?nodeId=${nodeB}`)).toBe(404);
    expect(
      await detailStatus(nodeAUserToken, complaintNodeB.id, '', hostileHeaders)
    ).toBe(404);
  });
});
