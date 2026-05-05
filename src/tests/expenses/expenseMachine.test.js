const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createOrder, authHeader } = require('../helpers');
const  Machine  = require('../../models/Machine');

// ═════════════════════════════════════════════
//  EXPENSE TESTS
// ═════════════════════════════════════════════

describe('EXPENSE ROUTES', () => {

  describe('POST /api/expenses', () => {
    it('branch manager can record an expense', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({
          description: 'Monthly electricity bill',
          category:    'utilities',
          amount:      150000,
          branch:      branch._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.amount).toBe(150000);
      expect(res.body.data.category).toBe('utilities');
    });

    it('should return 400 if description is too short', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Hi', category: 'utilities', amount: 1000, branch: branch._id.toString() });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/description/i);
    });

    it('should return 400 for invalid category', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Random expense', category: 'vacation', amount: 5000, branch: branch._id.toString() });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if amount is 0', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Zero amount', category: 'utilities', amount: 0, branch: branch._id.toString() });

      expect(res.statusCode).toBe(400);
    });

    it('staff cannot record expenses', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/expenses')
        .set(authHeader(staffToken))
        .send({ description: 'Staff expense attempt', category: 'utilities', amount: 5000, branch: branch._id.toString() });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/expenses', () => {
    it('manager can list expenses for their branch', async () => {
      const { managerToken, branch } = await seedContext();

      await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Water bill payment', category: 'utilities', amount: 30000, branch: branch._id.toString() });

      const res = await request(app)
        .get('/api/expenses')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports category filter', async () => {
      const { managerToken, branch } = await seedContext();

      await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Salary payment for staff', category: 'salaries', amount: 500000, branch: branch._id.toString() });

      const res = await request(app)
        .get('/api/expenses?category=salaries')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.every((e) => e.category === 'salaries')).toBe(true);
    });
  });

  describe('GET /api/expenses/by-category', () => {
    it('should return expense breakdown by category', async () => {
      const { managerToken, branch } = await seedContext();

      await request(app).post('/api/expenses').set(authHeader(managerToken))
        .send({ description: 'Electricity bill this month', category: 'utilities', amount: 80000, branch: branch._id.toString() });
      await request(app).post('/api/expenses').set(authHeader(managerToken))
        .send({ description: 'Staff salaries for month', category: 'salaries', amount: 200000, branch: branch._id.toString() });

      const res = await request(app)
        .get('/api/expenses/by-category')
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((e) => e._id === 'salaries')).toBe(true);
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    it('HQ admin can delete an expense', async () => {
      const { adminToken, managerToken, branch } = await seedContext();

      const create = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'To be deleted expense', category: 'other', amount: 1000, branch: branch._id.toString() });

      const expenseId = create.body.data._id;

      const res = await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
    });

    it('branch manager cannot delete an expense', async () => {
      const { managerToken, branch } = await seedContext();

      const create = await request(app)
        .post('/api/expenses')
        .set(authHeader(managerToken))
        .send({ description: 'Manager delete attempt', category: 'other', amount: 1000, branch: branch._id.toString() });

      const res = await request(app)
        .delete(`/api/expenses/${create.body.data._id}`)
        .set(authHeader(managerToken));

      expect(res.statusCode).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════
//  MACHINE TESTS
// ═════════════════════════════════════════════

describe('MACHINE ROUTES', () => {

  describe('POST /api/machines', () => {
    it('branch manager can add a machine', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Washer Unit A', type: 'washer', branch: branch._id.toString() });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('idle');
      expect(res.body.data.type).toBe('washer');
    });

    it('should return 400 for invalid machine type', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Bad Type', type: 'teleporter', branch: branch._id.toString() });

      expect(res.statusCode).toBe(400);
    });

    it('staff cannot add machines', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/machines')
        .set(authHeader(staffToken))
        .send({ name: 'Staff Machine', type: 'washer', branch: branch._id.toString() });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/machines/:id/status', () => {
    it('manager can update machine status', async () => {
      const { managerToken, branch } = await seedContext();

      const create = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Dryer B', type: 'dryer', branch: branch._id.toString() });

      const machineId = create.body.data._id;

      const res = await request(app)
        .patch(`/api/machines/${machineId}/status`)
        .set(authHeader(managerToken))
        .send({ status: 'maintenance' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('maintenance');
    });

    it('should return 400 for invalid status', async () => {
      const { managerToken, branch } = await seedContext();

      const create = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Washer X', type: 'washer', branch: branch._id.toString() });

      const res = await request(app)
        .patch(`/api/machines/${create.body.data._id}/status`)
        .set(authHeader(managerToken))
        .send({ status: 'broken' }); // not a valid enum value

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/machines/:id/usage', () => {
    it('staff can log machine usage', async () => {
      const { staffToken, managerToken, branch, customer, staff } = await seedContext();

      const machineRes = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Iron Press 1', type: 'iron_press', branch: branch._id.toString() });

      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post(`/api/machines/${machineRes.body.data._id}/usage`)
        .set(authHeader(staffToken))
        .send({
          orderId:   order._id.toString(),
          startTime: new Date().toISOString(),
        });

      expect(res.statusCode).toBe(201);
    });

    it('should return 400 if end time is before start time', async () => {
      const { staffToken, managerToken, branch, customer, staff } = await seedContext();

      const machineRes = await request(app)
        .post('/api/machines')
        .set(authHeader(managerToken))
        .send({ name: 'Washer Z', type: 'washer', branch: branch._id.toString() });

      const order = await createOrder(customer, branch, staff);
      const start = new Date();
      const end   = new Date(start.getTime() - 60000); // end before start

      const res = await request(app)
        .post(`/api/machines/${machineRes.body.data._id}/usage`)
        .set(authHeader(staffToken))
        .send({
          orderId:   order._id.toString(),
          startTime: start.toISOString(),
          endTime:   end.toISOString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/end time/i);
    });
  });
});