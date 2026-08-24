'use strict';

const { getSeedCountry, getSeedGovernorates } = require('./prismaLocationSetup');
const request = require('supertest');
const app = require('./prismaLocationApp');

describe('Locations API', () => {
  it('GET /api/locations/countries يرجع قائمة الدول', async () => {
    const res = await request(app).get('/api/locations/countries');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('nameAr');
    expect(res.body.data[0]).toHaveProperty('nameEn');
    expect(res.body.data[0]).toHaveProperty('iso2');
  });

  it('GET /api/locations/governorates يرجع قائمة المحافظات مرتبة عربياً', async () => {
    const res = await request(app).get('/api/locations/governorates');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toHaveProperty('nameAr');
    expect(res.body.data[0]).toHaveProperty('nameEn');
  });

  it('GET /api/locations/governorates?countryId=... تصفية المحافظات بحسب الدولة', async () => {
    const country = getSeedCountry();

    const res = await request(app).get(`/api/locations/governorates?countryId=${country.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((g) => expect(g.countryId).toBe(country.id));
  });

  it('GET /api/locations/governorates/:id/districts يرجع فقط مديريات تلك المحافظة', async () => {
    const { ibb } = getSeedGovernorates();

    const res = await request(app).get(`/api/locations/governorates/${ibb.id}/districts`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((d) => expect(d.governorateId).toBe(ibb.id));
  });

  it('GET /api/locations/governorates/:id/districts يرجع 404 لمحافظة غير موجودة', async () => {
    const res = await request(app).get('/api/locations/governorates/9999/districts');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
