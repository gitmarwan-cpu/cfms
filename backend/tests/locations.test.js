'use strict';

require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { Governorate } = require('../src/models');

describe('Locations API', () => {
  it('GET /api/locations/governorates يرجع قائمة المحافظات مرتبة عربياً', async () => {
    const res = await request(app).get('/api/locations/governorates');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toHaveProperty('nameAr');
    expect(res.body.data[0]).toHaveProperty('nameEn');
  });

  it('GET /api/locations/governorates/:id/districts يرجع فقط مديريات تلك المحافظة', async () => {
    const ibb = await Governorate.findOne({ where: { nameEn: 'Ibb' } });

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
