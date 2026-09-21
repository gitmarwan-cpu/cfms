'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/prisma/client');
const { createUserWithRole, getDefaultOrg } = require('./setup');
const { authenticate, authorizePlatformPermission } = require('../src/middlewares/auth');
const { resolveAuthenticatedTenant } = require('../src/middlewares/tenant');
const { resolvePublicTenant } = require('../src/middlewares/tenant');
const { errorHandler } = require('../src/middlewares/errorHandler');

const app = express();
app.get('/platform', authenticate, authorizePlatformPermission('platform.tenant.lifecycle'), (req, res) => {
  res.status(200).json({ success: true });
});
app.get('/tenant', authenticate, resolveAuthenticatedTenant, (req, res) => {
  res.status(200).json({ success: true, organizationId: req.organizationId });
});
app.get('/public/:orgSlug', resolvePublicTenant, (req, res) => {
  res.status(200).json({ success: true, organizationId: req.organizationId });
});
app.use(errorHandler);

describe('Phase 1 platform boundary and tenant lifecycle gating', () => {
  let platformOnlyUser;
  let platformOnlyToken;
  let tenantAdminToken;
  let dualUser;
  let dualToken;
  const organizationId = () => getDefaultOrg().id;

  beforeAll(async () => {
    const now = new Date();
    platformOnlyUser = await prisma.users.create({
      data: {
        full_name: 'Platform Only User',
        email: 'platform.only@cfms.local',
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.user_platform_roles.create({
      data: {
        user_id: platformOnlyUser.id,
        role_id: global.__rbacRoles.platformAdminRole.id,
        create_date: now,
        write_date: now,
      },
    });

    const tenantAdmin = await createUserWithRole({
      fullName: 'Tenant Admin',
      email: 'phase1.tenant.admin@cfms.local',
      roleCode: 'admin',
    });
    tenantAdminToken = jwt.sign({ sub: tenantAdmin.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const dual = await createUserWithRole({
      fullName: 'Dual Scope User',
      email: 'phase1.dual@cfms.local',
      roleCode: 'admin',
    });
    dualUser = dual.user;
    await prisma.user_platform_roles.create({
      data: {
        user_id: dualUser.id,
        role_id: global.__rbacRoles.platformAdminRole.id,
        create_date: now,
        write_date: now,
      },
    });

    platformOnlyToken = jwt.sign({ sub: platformOnlyUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    dualToken = jwt.sign({ sub: dualUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('keeps platform authority separate from tenant roles', async () => {
    const tenantResponse = await request(app)
      .get('/platform')
      .set('Authorization', `Bearer ${tenantAdminToken}`);
    const platformResponse = await request(app)
      .get('/platform')
      .set('Authorization', `Bearer ${platformOnlyToken}`);

    expect(tenantResponse.status).toBe(403);
    expect(platformResponse.status).toBe(200);
  });

  it('does not grant tenant access to a platform-only user', async () => {
    const response = await request(app)
      .get('/tenant')
      .set('Authorization', `Bearer ${platformOnlyToken}`)
      .set('x-organization-id', String(organizationId()));

    expect(response.status).toBe(403);
  });

  it('allows a dual-scope user only through both explicit authorities', async () => {
    const platformResponse = await request(app)
      .get('/platform')
      .set('Authorization', `Bearer ${dualToken}`);
    const tenantResponse = await request(app)
      .get('/tenant')
      .set('Authorization', `Bearer ${dualToken}`)
      .set('x-organization-id', String(organizationId()));

    expect(platformResponse.status).toBe(200);
    expect(tenantResponse.status).toBe(200);
  });

  it('blocks tenant access for suspended, deactivated, and archived tenants without changing memberships', async () => {
    const orgId = organizationId();
    const membershipBefore = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: dualUser.id, organization_id: orgId } },
    });
    const roleBefore = await prisma.user_roles.findFirst({
      where: { user_id: dualUser.id, organization_id: orgId },
    });

    for (const lifecycleStatus of ['suspended', 'deactivated', 'archived']) {
      await prisma.organizations.update({ where: { id: orgId }, data: { lifecycle_status: lifecycleStatus } });
      const response = await request(app)
        .get('/tenant')
        .set('Authorization', `Bearer ${dualToken}`)
        .set('x-organization-id', String(orgId));
      expect(response.status).toBe(403);
    }

    const membershipAfter = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: dualUser.id, organization_id: orgId } },
    });
    const roleAfter = await prisma.user_roles.findFirst({ where: { user_id: dualUser.id, organization_id: orgId } });
    expect(membershipAfter.is_active).toBe(membershipBefore.is_active);
    expect(roleAfter.id).toBe(roleBefore.id);

    await prisma.organizations.update({ where: { id: orgId }, data: { lifecycle_status: 'active' } });
    const reactivatedResponse = await request(app)
      .get('/tenant')
      .set('Authorization', `Bearer ${dualToken}`)
      .set('x-organization-id', String(orgId));
    expect(reactivatedResponse.status).toBe(200);
  });

  it('blocks public tenant access for suspended, deactivated, and archived tenants', async () => {
    const org = getDefaultOrg();
    for (const lifecycleStatus of ['suspended', 'deactivated', 'archived']) {
      await prisma.organizations.update({ where: { id: org.id }, data: { lifecycle_status: lifecycleStatus } });
      const response = await request(app).get(`/public/${org.slug}`);
      expect(response.status).toBe(404);
    }

    await prisma.organizations.update({ where: { id: org.id }, data: { lifecycle_status: 'active' } });
    await expect(request(app).get(`/public/${org.slug}`)).resolves.toMatchObject({ status: 200 });
  });
});
