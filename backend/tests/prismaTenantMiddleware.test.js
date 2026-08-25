'use strict';

const express = require('express');
const request = require('supertest');
const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const { errorHandler } = require('../src/middlewares/errorHandler');
const { resolvePublicTenant, resolveAuthenticatedTenant } = require('../src/middlewares/tenant.ts');

const organizationData = (slug, is_active = true) => ({
  legal_name: slug,
  slug,
  country: 'Yemen',
  default_language: 'ar',
  timezone: 'Asia/Aden',
  date_format: 'DD/MM/YYYY',
  primary_color: '#0e5f66',
  secondary_color: '#0a464b',
  accent_color: '#c77b3f',
  anonymous_complaints_policy: 'allowed',
  notification_settings: {},
  is_active,
  create_date: new Date(),
  write_date: new Date(),
});

describe('Prisma tenant middleware', () => {
  let activeOrganization;
  let otherOrganization;
  let inactiveOrganization;
  let user;

  beforeAll(async () => {
    await prepareTestDatabase();
    activeOrganization = await prisma.organizations.create({ data: organizationData('tenant-active') });
    otherOrganization = await prisma.organizations.create({ data: organizationData('tenant-other') });
    inactiveOrganization = await prisma.organizations.create({ data: organizationData('tenant-inactive', false) });
    user = await prisma.users.create({
      data: {
        full_name: 'Tenant Middleware User',
        email: 'prisma.tenant.middleware@cfms.local',
        password_hash: 'not-used',
        is_active: true,
        default_organization_id: activeOrganization.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: user.id,
        organization_id: activeOrganization.id,
        is_primary: true,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  const publicApp = () => {
    const app = express();
    app.get('/public/:orgSlug', resolvePublicTenant, (req, res) => {
      res.status(200).json({ organizationId: req.organizationId, organization: req.organization });
    });
    app.use(errorHandler);
    return app;
  };

  const authenticatedApp = (userOverride = user) => {
    const app = express();
    app.get('/tenant', (req, res, next) => {
      req.user = {
        id: userOverride.id,
        defaultOrganizationId: userOverride.default_organization_id,
      };
      next();
    }, resolveAuthenticatedTenant, (req, res) => {
      res.status(200).json({ organizationId: req.organizationId });
    });
    app.use(errorHandler);
    return app;
  };

  it('resolves an active public tenant and preserves request organization context', async () => {
    const response = await request(publicApp()).get(`/public/${activeOrganization.slug}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      organizationId: activeOrganization.id,
      organization: { id: activeOrganization.id, slug: activeOrganization.slug, isActive: true },
    });
  });

  it('rejects missing and inactive public organizations', async () => {
    expect((await request(publicApp()).get('/public/missing-tenant')).status).toBe(404);
    expect((await request(publicApp()).get(`/public/${inactiveOrganization.slug}`)).status).toBe(404);
  });

  it('resolves a valid default membership and an explicit valid membership', async () => {
    expect((await request(authenticatedApp()).get('/tenant')).body.organizationId).toBe(activeOrganization.id);

    await prisma.user_organizations.create({
      data: {
        user_id: user.id,
        organization_id: otherOrganization.id,
        is_primary: false,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    expect(
      (await request(authenticatedApp()).get('/tenant').set('X-Organization-Id', String(otherOrganization.id))).body
        .organizationId
    ).toBe(otherOrganization.id);
  });

  it('rejects an invalid tenant membership and does not permit tenant impersonation', async () => {
    const response = await request(authenticatedApp()).get('/tenant').set('X-Organization-Id', String(inactiveOrganization.id));
    expect(response.status).toBe(403);
  });

  it('rejects an authenticated user without a default organization', async () => {
    const noDefaultUser = { ...user, default_organization_id: null };
    expect((await request(authenticatedApp(noDefaultUser)).get('/tenant')).status).toBe(403);
  });
});

