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
  let attachment;
  let missingFileAttachment;
  let traversalAttachment;
  let adminToken;
  let otherAdminToken;
  let unauthorizedToken;
  let filePath;
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

    const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: 'Password123' })).body.data.token;
    adminToken = await login(admin.email);
    otherAdminToken = await login(otherAdmin.email);
    unauthorizedToken = await login(unauthorized.email);

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

    const uploadRoot = path.resolve(process.env.CFMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    fs.mkdirSync(uploadRoot, { recursive: true });
    const storedFileName = `attachment-test-${Date.now()}.pdf`;
    filePath = path.join(uploadRoot, storedFileName);
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
    if (filePath) fs.rmSync(filePath, { force: true });
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

  it('rejects unauthenticated and unauthorized retrieval', async () => {
    const unauthenticated = await request(app).get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`);
    const unauthorized = await request(app)
      .get(`/api/complaints/${complaint.id}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(unauthenticated.status).toBe(401);
    expect(unauthorized.status).toBe(403);
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
});
