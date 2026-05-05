const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createOrder, createPayment, authHeader } = require('../helpers');

// ═════════════════════════════════════════════
//  REPORT TESTS
// ═════════════════════════════════════════════

describe('REPORT ROUTES', () => {

  describe('GET /api/reports/dashboard', () => {
    it('HQ admin can access the global dashboard', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.branches).toBeDefined();
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.finance).toBeDefined();
      expect(res.body.data.customers).toBeDefined();
    });

    it('branch manager cannot access HQ dashboard', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(403);
    });

    it('staff cannot access HQ dashboard', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/reports/dashboard/branch/:branchId', () => {
    it('branch manager can access their branch dashboard', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/reports/dashboard/branch/${branch._id}`)
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.finance).toBeDefined();
    });

    it('HQ admin can access any branch dashboard', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/reports/dashboard/branch/${branch._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
    });

    it('staff cannot access branch dashboard', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/reports/dashboard/branch/${branch._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/reports/revenue', () => {
    it('manager can view revenue report', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);
      await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .get('/api/reports/revenue')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(res.body.data.byDay).toBeDefined();
      expect(res.body.data.byMethod).toBeDefined();
    });

    it('staff cannot access revenue report', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/revenue')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/reports/profit-loss', () => {
    it('manager can view profit/loss report', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totals).toBeDefined();
      expect(res.body.data.byBranch).toBeDefined();
    });
  });

  describe('GET /api/reports/uncollected', () => {
    it('manager can view uncollected items report', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/uncollected')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.count).toBeDefined();
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });
  });

  describe('GET /api/reports/customers', () => {
    it('manager can view customer report', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/customers')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.topSpenders).toBeDefined();
    });
  });

  describe('GET /api/reports/staff-activity', () => {
    it('manager can view staff activity report', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);
      await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .get('/api/reports/staff-activity')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.ordersByStaff).toBeDefined();
      expect(res.body.data.paymentsByStaff).toBeDefined();
    });
  });

  describe('GET /api/reports/fraud-risk', () => {
    it('HQ admin can view fraud risk report', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/fraud-risk')
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.flaggedPayments).toBeDefined();
      expect(res.body.data.collectedWithoutFullPayment).toBeDefined();
    });

    it('branch manager cannot access fraud report', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/reports/fraud-risk')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════
//  FEEDBACK TESTS
// ═════════════════════════════════════════════

describe('FEEDBACK ROUTES', () => {

  describe('POST /api/feedback', () => {
    it('staff can submit feedback for an order', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/feedback')
        .set(authHeader(staffToken))
        .send({
          customer: customer._id.toString(),
          order:    order._id.toString(),
          rating:   5,
          comment:  'Excellent service',
          category: 'service_quality',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.rating).toBe(5);
    });

    it('should return 400 if rating is out of range', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/feedback')
        .set(authHeader(staffToken))
        .send({
          customer: customer._id.toString(),
          order:    order._id.toString(),
          rating:   6, // max is 5
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/rating/i);
    });

    it('should return 400 for duplicate feedback on same order', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const payload = {
        customer: customer._id.toString(),
        order:    order._id.toString(),
        rating:   4,
        branch:   branch._id.toString(),
      };

      await request(app).post('/api/feedback').set(authHeader(staffToken)).send(payload);

      const res = await request(app)
        .post('/api/feedback')
        .set(authHeader(staffToken))
        .send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already been submitted/i);
    });

    it('should return 400 for invalid category', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/feedback')
        .set(authHeader(staffToken))
        .send({
          customer: customer._id.toString(),
          order:    order._id.toString(),
          rating:   3,
          category: 'invalid_category',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/feedback/branch/:branchId', () => {
    it('manager can view feedback for their branch', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      await request(app).post('/api/feedback').set(authHeader(managerToken))
        .send({ customer: customer._id.toString(), order: order._id.toString(), rating: 4, branch: branch._id.toString() });

      const res = await request(app)
        .get(`/api/feedback/branch/${branch._id}`)
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('staff cannot view branch feedback', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .get(`/api/feedback/branch/${branch._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/feedback/ratings', () => {
    it('manager can view average ratings', async () => {
      const { managerToken } = await seedContext();

      const res = await request(app)
        .get('/api/feedback/ratings')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/feedback/:id/reviewed', () => {
    it('manager can mark feedback as reviewed', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const create = await request(app).post('/api/feedback').set(authHeader(managerToken))
        .send({ customer: customer._id.toString(), order: order._id.toString(), rating: 3, branch: branch._id.toString() });

      const res = await request(app)
        .patch(`/api/feedback/${create.body.data._id}/reviewed`)
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isReviewed).toBe(true);
    });
  });
});