'use strict';

require('./setup');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { default: app } = require('../src/app');
const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
const { createOrganization, createUserWithRole, getSeedGovernorateId } = require('./setup');

describe('Complaint attachment retrieval', () => {
  let organization;
  let otherOrganization;
  let complaint;
  let otherComplaint;
  let assignedComplaint;
  let attachment;
  let assignedAttachment;
  let missingFileAttachment;
  let traversalAttachment;
  let adminToken;
  let adminUser;
  let otherAdminToken;
  let unauthorizedToken;
  let noPermissionToken;
  let filePath;
  let uploadRoot;
  let unrelatedUploadFilePath;
  const ownedUploadFiles = new Set();
  const fileContent = Buffer.from('%PDF-1.4\nCFMS attachment test\n');

  beforeAll(async () => {
    const governorateId = getSeedGovernorateId();
    const district = await prisma.districts.findFirst({ where: { governorate_id: governorateId } });
    organization = await createOrganization({ legalName: 'Attachment Test Organization', slug: `attachment-test-${Date.now()}` });
    otherOrganization = await createOrganization({ legalName: 'Other Attachment Organization', slug: `attachment-other-${Date.now()}` });

    const { user: admin } = await createUserWithRole({
      fullName: 'Attachment Admin',
      email: `attachment-admin-${Date.now()}@cfms.local`,
      roleCode: 'admin',
      organizationId: organization.id,
    }, 'Password123');
    adminUser = admin;
    const { user: otherAdmin } = await createUserWithRole({
      fullName: 'Other Attachment Admin',
      email: `attachment-other-admin-${Date.now()}@cfms.local`,
      roleCode: 'admin',
      organizationId: otherOrganization.id,
    }, 'Password123');
    const { user: unauthorized } = await createUserWithRole({
      fullName: 'Attachment Unauthorized',
      email: `attachment-unauthorized-${Date.now()}@cfms.local`,
      roleCode: 'staff',
      organizationId: organization.id,
    }, 'Password123');
    const { user: noPermission } = await createUserWithRole({
      fullName: 'Attachment No Permission',
      email: `attachment-noperm-${Date.now()}@cfms.local`,
      roleCode: 'staff',
      organizationId: organization.id,
    }, 'Password123');
    await prisma.user_roles.deleteMany({ where: { user_id: noPermission.id } });

    const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: 'Password123' })).body.data.token;
    adminToken = await login(admin.email);
    otherAdminToken = await login(otherAdmin.email);
    unauthorizedToken = await login(unauthorized.email);
    noPermissionToken = await login(noPermission.email);

    const payload = (description) => ({
      type: 'complaint',
      isAnonymous: true,
      governorateId: String(governorateId),
      districtId: String(district.id),
      category: 'service_quality',
      description,
      consentGiven: true,
    });
    complaint = (await complaintService.createComplaint(organization.id, payload('Attachment retrieval complaint'))).complaint;
    otherComplaint = (await complaintService.createComplaint(organization.id, payload('Second attachment complaint'))).complaint;

    uploadRoot = path.resolve(process.env.CFMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    fs.mkdirSync(uploadRoot, { recursive: true });
    unrelatedUploadFilePath = path.join(uploadRoot, `attachment-unrelated-${Date.now()}.txt`);
    fs.writeFileSync(unrelatedUploadFilePath, 'must survive request cleanup');
    ownedUploadFiles.add(unrelatedUploadFilePath);
    const storedFileName = `attachment-test-${Date.now()}.pdf`;
    filePath = path.join(uploadRoot, storedFileName);
    ownedUploadFiles.add(filePath);
    fs.writeFileSync(filePath, fileContent);
    attachment = await prisma.complaint_attachments.create({
      data: {
        complaint_id: complaint.id,
        original_name: 'evidence.pdf',
        stored_file_name: storedFileName,
        mime_type: 'application/pdf',
        size_bytes: fileContent.length,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    assignedComplaint = (await complaintService.createComplaint(organization.id, payload('Assigned staff complaint'))).complaint;
    await prisma.complaints.update({
      where: { id: assignedComplaint.id },
      data: { assigned_to_user_id: unauthorized.id },
    });
    assignedAttachment = await prisma.complaint_attachments.create({
      data: {
        complaint_id: assignedComplaint.id,
        original_name: 'assigned.pdf',
        stored_file_name: storedFileName,
        mime_type: 'application/pdf',
        size_bytes: fileContent.length,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    missingFileAttachment = await prisma.complaint_attachments.create({
      data: {
        complaint_id: complaint.id,
        original_name: 'missing.pdf',
        stored_file_name: `missing-${Date.now()}.pdf`,
        mime_type: 'application/pdf',
        size_bytes: 10,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    traversalAttachment = await prisma.complaint_attachments.create({
      data: {
        complaint_id: complaint.id,
        original_name: 'traversal.pdf',
        stored_file_name: '../outside.pdf',
        mime_type: 'application/pdf',
        size_bytes: 10,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
  });

  afterAll(() => {
    for (const file of ownedUploadFiles) fs.rmSync(file, { force: true });
  });

  it('retrieves the attachment for an authorized same-tenant user', async () => {
    const response = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(fileContent);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-disposition']).toContain("attachment; filename*=UTF-8''evidence.pdf");
  });

  it('allows attachment retrieval for a staff user assigned to the complaint (view_own)', async () => {
    const response = await request(app)
      .get(`/api/complaints/${assignedComplaint.id}/attachments/${assignedAttachment.id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(fileContent);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-disposition']).toContain("attachment; filename*=UTF-8''assigned.pdf");
  });

  it('rejects unauthenticated and unauthorized retrieval', async () => {
    const unauthenticated = await request(app).get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`);
    const noPermission = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${noPermissionToken}`);
    const outOfScope = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(unauthenticated.status).toBe(401);
    expect(noPermission.status).toBe(403);
    expect(outOfScope.status).toBe(404);
  });

  it('rejects cross-tenant and mismatched complaint access with 404', async () => {
    const crossTenant = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);
    const mismatched = await request(app)
      .get(`/api/complaints/${otherComplaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(crossTenant.status).toBe(404);
    expect(mismatched.status).toBe(404);
  });

  it('returns 404 for missing physical files and traversal paths', async () => {
    const missingFile = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${missingFileAttachment.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const traversal = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${traversalAttachment.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(missingFile.status).toBe(404);
    expect(traversal.status).toBe(404);
  });

  it('does not expose attachment retrieval through the public tracking routes', async () => {
    const response = await request(app)
      .get(`/api/public/${organization.slug}/complaints/${complaint.id}/attachments/${attachment.id}`);

    expect(response.status).toBe(404);
  });

  describe('Post-creation attachment upload (GAP-02 / WS 1.4)', () => {
    const validPdf = Buffer.from('%PDF-1.4\nCFMS upload test\n%%EOF');
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const invalidSignaturePdf = Buffer.from('NOT_A_REAL_PDF_DATA_CONTENT');
    const invalidMimeText = Buffer.from('plain text content');
    const oversizedPdf = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);

    const uploadFileNames = () => fs.readdirSync(uploadRoot).sort();
    const expectNoNewUploadFiles = (beforeFiles) => {
      expect(uploadFileNames()).toEqual(beforeFiles);
      expect(fs.existsSync(unrelatedUploadFilePath)).toBe(true);
    };

    it('allows an authorized user (complaints.assign) to upload attachments to an existing complaint', async () => {
      const beforeComplaint = await prisma.complaints.findUnique({ where: { id: complaint.id } });

      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', validPdf, 'document.pdf')
        .attach('attachments', validPng, 'image.png');

      if (response.status === 201 && Array.isArray(response.body?.data)) {
        response.body.data.forEach((attachment) => ownedUploadFiles.add(path.join(uploadRoot, attachment.storedFileName)));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('تم رفع المرفقات بنجاح');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        complaintId: complaint.id,
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
      });
      expect(response.body.data[1]).toMatchObject({
        complaintId: complaint.id,
        originalName: 'image.png',
        mimeType: 'image/png',
      });
      // Verify records created in database
      const dbAttachments = await prisma.complaint_attachments.findMany({
        where: { complaint_id: complaint.id, original_name: { in: ['document.pdf', 'image.png'] } },
      });
      expect(dbAttachments).toHaveLength(2);
      expect(dbAttachments[0].create_uid).toBe(adminUser.id);
      expect(dbAttachments[0].write_uid).toBe(adminUser.id);

      // Verify complaint's write_date and write_uid were updated
      const afterComplaint = await prisma.complaints.findUnique({ where: { id: complaint.id } });
      expect(afterComplaint.write_uid).toBe(adminUser.id);
      expect(new Date(afterComplaint.write_date).getTime()).toBeGreaterThanOrEqual(new Date(beforeComplaint.write_date).getTime());
    });

    it('allows a tenant-scoped actor with only complaints.assign to upload attachments', async () => {
      const { user: assignOnlyUser } = await createUserWithRole({
        fullName: 'Attachment Assign Only',
        email: `attachment-assign-only-${Date.now()}@cfms.local`,
        roleCode: 'staff',
        organizationId: organization.id,
      }, 'Password123');

      await prisma.user_roles.deleteMany({ where: { user_id: assignOnlyUser.id } });
      const role = await prisma.roles.create({
        data: {
          code: `attachment_assign_only_${Date.now()}`,
          name_ar: 'دور رفع المرفقات بالتعيين فقط',
          create_date: new Date(),
          write_date: new Date(),
        },
      });
      const assignPermission = await prisma.permissions.findUnique({ where: { code: 'complaints.assign' } });
      expect(assignPermission).toBeTruthy();
      await prisma.role_permissions.create({
        data: { role_id: role.id, permission_id: assignPermission.id, created_at: new Date() },
      });
      await prisma.user_roles.create({
        data: {
          user_id: assignOnlyUser.id,
          role_id: role.id,
          organization_id: organization.id,
          organization_node_id: null,
          create_date: new Date(),
          write_date: new Date(),
        },
      });

      const effectiveRolePermissions = await prisma.role_permissions.findMany({
        where: { role_id: role.id },
        select: { permissions: { select: { code: true } } },
      });
      expect(effectiveRolePermissions.map(({ permissions }) => permissions.code)).toEqual(['complaints.assign']);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: assignOnlyUser.email, password: 'Password123' });
      expect(loginResponse.status).toBe(200);

      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .set('X-Organization-Id', String(organization.id))
        .attach('attachments', validPdf, 'assign-only.pdf');

      response.body?.data?.forEach((attachment) => {
        if (typeof attachment?.storedFileName === 'string') {
          ownedUploadFiles.add(path.join(uploadRoot, attachment.storedFileName));
        }
      });
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        complaintId: complaint.id,
        originalName: 'assign-only.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('allows assigned staff with complaints.view_own to upload attachments to their assigned complaint', async () => {
      const response = await request(app)
        .post(`/api/complaints/${assignedComplaint.id}/attachments`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .attach('attachments', validPdf, 'assigned_evidence.pdf');

      if (response.status === 201 && typeof response.body?.data?.[0]?.storedFileName === 'string') {
        ownedUploadFiles.add(path.join(uploadRoot, response.body.data[0].storedFileName));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].originalName).toBe('assigned_evidence.pdf');

      const dbAttachment = await prisma.complaint_attachments.findFirst({
        where: { complaint_id: assignedComplaint.id, original_name: 'assigned_evidence.pdf' },
      });
      expect(dbAttachment).toBeTruthy();
    });

    it('rejects uploads with invalid MIME type (422)', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', invalidMimeText, 'notes.txt');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects uploads with mismatched file signature (422)', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', invalidSignaturePdf, 'corrupt.pdf');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects requests with more than three files (exceeds limit)', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', validPdf, 'file1.pdf')
        .attach('attachments', validPdf, 'file2.pdf')
        .attach('attachments', validPdf, 'file3.pdf')
        .attach('attachments', validPdf, 'file4.pdf');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects oversized uploads without leaving a disk file', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', oversizedPdf, 'oversized.pdf');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects cross-tenant and out-of-scope complaints with 404', async () => {
      // Cross-tenant: other admin accessing another organization's complaint
      const beforeCrossTenantFiles = uploadFileNames();
      const crossTenant = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .attach('attachments', validPdf, 'cross.pdf');

      // Out-of-scope: staff with view_own accessing complaint not assigned to them
      const beforeOutOfScopeFiles = uploadFileNames();
      const outOfScope = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .attach('attachments', validPdf, 'out_of_scope.pdf');

      // Non-existent complaint ID
      const beforeNotFoundFiles = uploadFileNames();
      const notFound = await request(app)
        .post('/api/complaints/999999/attachments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', validPdf, 'not_found.pdf');

      expect(crossTenant.status).toBe(404);
      expect(outOfScope.status).toBe(404);
      expect(notFound.status).toBe(404);
      expectNoNewUploadFiles(beforeCrossTenantFiles);
      expectNoNewUploadFiles(beforeOutOfScopeFiles);
      expectNoNewUploadFiles(beforeNotFoundFiles);
    });

    it('rejects an invalid complaint ID without leaving a disk file', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post('/api/complaints/not-an-id/attachments')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('attachments', validPdf, 'invalid_id.pdf');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .attach('attachments', validPdf, 'unauth.pdf');

      expect(response.status).toBe(401);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('rejects authenticated callers without either required permission with 403', async () => {
      const beforeFiles = uploadFileNames();
      const response = await request(app)
        .post(`/api/complaints/${complaint.id}/attachments`)
        .set('Authorization', `Bearer ${noPermissionToken}`)
        .attach('attachments', validPdf, 'no_perm.pdf');

      expect(response.status).toBe(403);
      expectNoNewUploadFiles(beforeFiles);
    });

    it('cleans up newly uploaded disk files on database persistence failure', async () => {
      const uploadRoot = path.resolve(process.env.CFMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
      const beforeFiles = fs.readdirSync(uploadRoot);

      const origTransaction = prisma.$transaction.bind(prisma);
      const transactionSpy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback) => {
        return origTransaction(async (tx) => {
          await callback(tx);
          throw new Error('Simulated database persistence failure for orphan cleanup verification');
        });
      });

      try {
        const response = await request(app)
          .post(`/api/complaints/${complaint.id}/attachments`)
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('attachments', validPdf, 'will_fail.pdf');

        expect(response.status).toBe(500);

        // Verify no newly written file remains orphaned on disk
        const afterFiles = fs.readdirSync(uploadRoot);
        expect(afterFiles.sort()).toEqual(beforeFiles.sort());
        expect(fs.existsSync(unrelatedUploadFilePath)).toBe(true);
      } finally {
        transactionSpy.mockRestore();
      }
    });
  });
});
