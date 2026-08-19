'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const { authenticate } = require('../src/middlewares/auth.ts');
const { errorHandler } = require('../src/middlewares/errorHandler');
const { resolveAuthenticatedTenant } = require('../src/middlewares/tenant');

const createApp = (withTenant = false) => {
  const app = express();
  app.get('/protected', authenticate, ...(withTenant ? [resolveAuthenticatedTenant] : []), (req, res) => {
    res.status(200).json({ success: true, data: req.user });
  });
  app.use(errorHandler);
  return app;
};

describe('Prisma authentication middleware', () => {
  let activeUser;
  let organization;
  let otherOrganization;

  beforeAll(async () => {
    await prepareTestDatabase();
    const now = new Date();
    [organization, otherOrganization] = await Promise.all([
      prisma.organizations.create({
        data: {
          legal_name: 'Auth Organization',
          slug: 'auth-organization',
          country: 'Yemen',
          default_language: 'ar',
          timezone: 'Asia/Aden',
          date_format: 'DD/MM/YYYY',
          primary_color: '#0e5f66',
          secondary_color: '#0a464b',
          accent_color: '#c77b3f',
          anonymous_complaints_policy: 'allowed',
          notification_settings: {},
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      }),
      prisma.organizations.create({
        data: {
          legal_name: 'Other Organization',
          slug: 'other-auth-organization',
          country: 'Yemen',
          default_language: 'ar',
          timezone: 'Asia/Aden',
          date_format: 'DD/MM/YYYY',
          primary_color: '#0e5f66',
          secondary_color: '#0a464b',
          accent_color: '#c77b3f',
          anonymous_complaints_policy: 'allowed',
          notification_settings: {},
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      }),
    ]);

    activeUser = await prisma.users.create({
      data: {
        full_name: 'Authenticated Prisma User',
        email: 'prisma.auth.middleware@cfms.local',
        password_hash: 'not-used',
        is_active: true,
        default_organization_id: organization.id,
        created_at: now,
        updated_at: now,
      },
    });
    await prisma.user_organizations.create({
      data: {
        user_id: activeUser.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  const tokenFor = (sub, expiresIn = '1h') => jwt.sign({ sub }, process.env.JWT_SECRET, { expiresIn });

  it('authenticates an active Prisma user and preserves request.user shape', async () => {
    const response = await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(activeUser.id)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: activeUser.id,
      fullName: 'Authenticated Prisma User',
      defaultOrganizationId: organization.id,
      roleCodes: [],
      permissions: [],
    });
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects missing, malformed, and expired tokens', async () => {
    await expect(request(createApp()).get('/protected')).resolves.toMatchObject({ status: 401 });
    await expect(
      request(createApp()).get('/protected').set('Authorization', 'Bearer invalid-token')
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      request(createApp()).get('/protected').set('Authorization', `Bearer ${tokenFor(activeUser.id, '-1s')}`)
    ).resolves.toMatchObject({ status: 401 });
  });

  it('rejects users that no longer exist or are inactive', async () => {
    const missingResponse = await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(999999)}`);
    expect(missingResponse.status).toBe(401);

    const inactive = await prisma.users.create({
      data: {
        full_name: 'Inactive Prisma User',
        email: 'prisma.auth.inactive@cfms.local',
        password_hash: 'not-used',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const inactiveResponse = await request(createApp())
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(inactive.id)}`);
    expect(inactiveResponse.status).toBe(401);
  });

  it('does not allow the authenticated user to select another tenant', async () => {
    const response = await request(createApp(true))
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(activeUser.id)}`)
      .set('X-Organization-Id', String(otherOrganization.id));

    expect(response.status).toBe(403);
  });
});

