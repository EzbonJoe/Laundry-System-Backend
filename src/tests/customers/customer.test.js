const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createCustomer, authHeader } = require('../helpers');

describe('CUSTOMER ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/customers
  // ─────────────────────────────────────────────

  describe('POST /api/customers', () => {
    it('staff can create a customer', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/customers')
        .set(authHeader(staffToken))
        .send({
          name:   'Alice Nakato',
          phone:  '+256712345678',
          branch: branch._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('Alice Nakato');
    });

    it('should return 400 if phone is missing', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/customers')
        .set(authHeader(staffToken))
        .send({ name: 'No Phone', branch: branch._id.toString() });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/phone/i);
    });

    it('should return 400 if customer phone already exists at branch', async () => {
      const { staffToken, branch, customer } = await seedContext();

      const res = await request(app)
        .post('/api/customers')
        .set(authHeader(staffToken))
        .send({
          name:   'Duplicate Customer',
          phone:  customer.phone,
          branch: branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should return 400 for invalid email format', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/customers')
        .set(authHeader(staffToken))
        .send({
          name:   'Bad Email',
          phone:  '+256799999999',
          email:  'not-an-email',
          branch: branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/email/i);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/customers
  // ─────────────────────────────────────────────

  describe('GET /api/customers', () => {
    it('staff can list customers (filtered to their branch)', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/customers')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('HQ admin can see all customers across branches', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .get('/api/customers')
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
    });

    it('supports search by name', async () => {
      const { staffToken, branch } = await seedContext();
      await createCustomer(branch, { name: 'Unique Name XYZ', phone: '+256788880001' });

      const res = await request(app)
        .get('/api/customers?search=Unique Name XYZ')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.some((c) => c.name === 'Unique Name XYZ')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/customers/:id
  // ─────────────────────────────────────────────

  describe('GET /api/customers/:id', () => {
    it('should return customer by ID', async () => {
      const { staffToken, customer } = await seedContext();

      const res = await request(app)
        .get(`/api/customers/${customer._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id.toString()).toBe(customer._id.toString());
    });

    it('should return 404 for unknown customer ID', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/customers/64f1a2b3c4d5e6f7a8b9c0d1')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  //  PUT /api/customers/:id
  // ─────────────────────────────────────────────

  describe('PUT /api/customers/:id', () => {
    it('branch manager can update a customer', async () => {
      const { managerToken, customer } = await seedContext();

      const res = await request(app)
        .put(`/api/customers/${customer._id}`)
        .set(authHeader(managerToken))
        .send({ name: 'Updated Name' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('staff cannot update a customer', async () => {
      const { staffToken, customer } = await seedContext();

      const res = await request(app)
        .put(`/api/customers/${customer._id}`)
        .set(authHeader(staffToken))
        .send({ name: 'Staff Update' });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/customers/status/loyal
  // ─────────────────────────────────────────────

  describe('GET /api/customers/status/loyal', () => {
    it('should return loyal customers', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/customers/status/loyal')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/customers/:id/orders
  // ─────────────────────────────────────────────

  describe('GET /api/customers/:id/orders', () => {
    it('should return order history for a customer', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();

      const { createOrder } = require('../helpers');
      await createOrder(customer, branch, staff);

      const res = await request(app)
        .get(`/api/customers/${customer._id}/orders`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});