const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createBranch, authHeader } = require('../helpers');

describe('BRANCH ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/branches
  // ─────────────────────────────────────────────

  describe('POST /api/branches', () => {
    it('HQ admin can create a branch', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .post('/api/branches')
        .set(authHeader(adminToken))
        .send({ name: 'Entebbe Branch', location: 'Entebbe', phone: '+256700000099' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('Entebbe Branch');
    });

    it('should return 400 if name is missing', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .post('/api/branches')
        .set(authHeader(adminToken))
        .send({ location: 'Entebbe' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/name/i);
    });

    it('should return 400 if location is missing', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .post('/api/branches')
        .set(authHeader(adminToken))
        .send({ name: 'No Location Branch' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/location/i);
    });

    it('should return 403 if branch manager tries to create a branch', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .post('/api/branches')
        .set(authHeader(managerToken))
        .send({ name: 'Unauthorised Branch', location: 'Somewhere' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 if staff tries to create a branch', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .post('/api/branches')
        .set(authHeader(staffToken))
        .send({ name: 'Staff Branch', location: 'Somewhere' });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/branches
  // ─────────────────────────────────────────────

  describe('GET /api/branches', () => {
    it('should return all branches', async () => {
      const { adminToken } = await seedContext();
      await createBranch({ name: 'Branch Two', location: 'Jinja' });

      const res = await request(app)
        .get('/api/branches')
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get('/api/branches');
      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/branches/:id
  // ─────────────────────────────────────────────

  describe('GET /api/branches/:id', () => {
    it('should return a single branch by ID', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/branches/${branch._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id.toString()).toBe(branch._id.toString());
    });

    it('should return 404 for a non-existent branch ID', async () => {
      const { adminToken } = await seedContext();
      const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';

      const res = await request(app)
        .get(`/api/branches/${fakeId}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  //  PUT /api/branches/:id
  // ─────────────────────────────────────────────

  describe('PUT /api/branches/:id', () => {
    it('HQ admin can update a branch', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .put(`/api/branches/${branch._id}`)
        .set(authHeader(adminToken))
        .send({ name: 'Updated Branch Name' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe('Updated Branch Name');
    });

    it('branch manager can update their own branch', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .put(`/api/branches/${branch._id}`)
        .set(authHeader(managerToken))
        .send({ address: '99 New Street' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.address).toBe('99 New Street');
    });

    it('staff cannot update a branch', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .put(`/api/branches/${branch._id}`)
        .set(authHeader(staffToken))
        .send({ name: 'Staff Update Attempt' });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  DELETE /api/branches/:id  (deactivate)
  // ─────────────────────────────────────────────

  describe('DELETE /api/branches/:id', () => {
    it('HQ admin can deactivate a branch', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .delete(`/api/branches/${branch._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);

      const  Branch  = require('../../models/Branch');
      const updated = await Branch.findById(branch._id);
      expect(updated.isActive).toBe(false);
    });

    it('branch manager cannot deactivate a branch', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .delete(`/api/branches/${branch._id}`)
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/branches/:id/stats
  // ─────────────────────────────────────────────

  describe('GET /api/branches/:id/stats', () => {
    it('should return branch stats for HQ admin', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/branches/${branch._id}/stats`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.finance).toBeDefined();
    });

    it('staff cannot access branch stats', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/branches/${branch._id}/stats`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });
});