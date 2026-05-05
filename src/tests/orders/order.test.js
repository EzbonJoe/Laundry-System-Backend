const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createOrder, authHeader } = require('../helpers');

const validOrderBody = (customerId, branchId) => ({
  customer: customerId,
  branch:   branchId,
  items: [
    {
      category:    'shirt',
      serviceType: 'wash',
      quantity:    3,
      unitPrice:   4000,
    },
  ],
  collectionType: 'pickup',
  amountPaid:     0,
});

describe('ORDER ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/orders
  // ─────────────────────────────────────────────

  describe('POST /api/orders', () => {
    it('staff can create an order', async () => {
      const { staffToken, customer, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send(validOrderBody(customer._id.toString(), branch._id.toString()));

      expect(res.statusCode).toBe(201);
      expect(res.body.data.orderNumber).toMatch(/^EZB-/);
      expect(res.body.data.status).toBe('received');
      expect(res.body.data.totalAmount).toBe(12000); // 3 × 4000
    });

    it('should auto-calculate totalAmount from items', async () => {
      const { staffToken, customer, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send({
          ...validOrderBody(customer._id.toString(), branch._id.toString()),
          items: [
            { category: 'shirt',  serviceType: 'wash',  quantity: 2, unitPrice: 5000 },
            { category: 'trouser', serviceType: 'iron', quantity: 1, unitPrice: 3000 },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.totalAmount).toBe(13000); // (2×5000) + (1×3000)
    });

    it('should return 400 if items array is empty', async () => {
      const { staffToken, customer, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send({ ...validOrderBody(customer._id.toString(), branch._id.toString()), items: [] });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if customer ID is invalid', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send(validOrderBody('not-a-valid-id', branch._id.toString()));

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if delivery address missing for delivery orders', async () => {
      const { staffToken, customer, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send({
          ...validOrderBody(customer._id.toString(), branch._id.toString()),
          collectionType: 'delivery',
          // no deliveryAddress
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/delivery address/i);
    });

    it('should return 400 if expectedReadyDate is in the past', async () => {
      const { staffToken, customer, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send({
          ...validOrderBody(customer._id.toString(), branch._id.toString()),
          expectedReadyDate: '2020-01-01',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/past/i);
    });

    it('should return 404 if customer does not exist', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(staffToken))
        .send(validOrderBody('64f1a2b3c4d5e6f7a8b9c0d1', branch._id.toString()));

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/orders
  // ─────────────────────────────────────────────

  describe('GET /api/orders', () => {
    it('staff can list orders for their branch', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      await createOrder(customer, branch, staff);

      const res = await request(app)
        .get('/api/orders')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports filtering by status', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      await createOrder(customer, branch, staff, { status: 'washing' });

      const res = await request(app)
        .get('/api/orders?status=washing')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.every((o) => o.status === 'washing')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/orders/:id
  // ─────────────────────────────────────────────

  describe('GET /api/orders/:id', () => {
    it('should return full order details', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should return 404 for unknown order', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .get('/api/orders/64f1a2b3c4d5e6f7a8b9c0d1')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  //  PATCH /api/orders/:id/status
  // ─────────────────────────────────────────────

  describe('PATCH /api/orders/:id/status', () => {
    it('should advance order to next valid status', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set(authHeader(staffToken))
        .send({ status: 'washing' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('washing');
    });

    it('should reject invalid status transitions', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff); // status = received

      // Cannot jump from received directly to collected
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set(authHeader(staffToken))
        .send({ status: 'collected' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid status transition/i);
    });

    it('should return 400 for unknown status value', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set(authHeader(staffToken))
        .send({ status: 'flying' });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  //  PATCH /api/orders/:id/collect
  // ─────────────────────────────────────────────

  describe('PATCH /api/orders/:id/collect', () => {
    it('should mark a paid ready order as collected', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff, {
        status:        'ready',
        amountPaid:    10000,
        paymentStatus: 'paid',
      });

      const res = await request(app)
        .patch(`/api/orders/${order._id}/collect`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('collected');
    });

    it('should block collection if payment is incomplete', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff, {
        status:        'ready',
        amountPaid:    0,
        paymentStatus: 'unpaid',
      });

      const res = await request(app)
        .patch(`/api/orders/${order._id}/collect`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/payment/i);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/orders/uncollected
  // ─────────────────────────────────────────────

  describe('GET /api/orders/uncollected', () => {
    it('should return uncollected orders past threshold', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();

      // Create order with an old ready date to simulate uncollected
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      await createOrder(customer, branch, staff, {
        status:            'ready',
        expectedReadyDate: oldDate,
      });

      const res = await request(app)
        .get('/api/orders/uncollected')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  DELETE /api/orders/:id
  // ─────────────────────────────────────────────

  describe('DELETE /api/orders/:id', () => {
    it('HQ admin can delete a non-collected order', async () => {
      const { adminToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
    });

    it('should return 400 if trying to delete a collected order', async () => {
      const { adminToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff, { status: 'collected' });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(400);
    });

    it('staff cannot delete orders', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(403);
    });
  });
});