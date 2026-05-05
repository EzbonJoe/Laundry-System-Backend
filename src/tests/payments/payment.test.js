const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createOrder, createPayment, authHeader } = require('../helpers');

describe('PAYMENT ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/payments
  // ─────────────────────────────────────────────

  describe('POST /api/payments', () => {
    it('staff can record a full payment', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 10000, method: 'cash' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.receiptNumber).toMatch(/^RCT-/);
      expect(res.body.data.amount).toBe(10000);
    });

    it('should update order paymentStatus to paid after full payment', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 10000, method: 'cash' });

      const  Order  = require('../../models/Order');
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('paid');
      expect(updated.amountPaid).toBe(10000);
    });

    it('should flag payment if amount is less than total', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff); // totalAmount = 10000

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 3000, method: 'cash' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.isFlagged).toBe(true);
      expect(res.body.data.flagReason).toBeDefined();
    });

    it('should return 400 if order is already fully paid', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff, {
        amountPaid: 10000, paymentStatus: 'paid',
      });

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 5000, method: 'cash' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already.*paid/i);
    });

    it('should return 400 if amount is 0', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 0, method: 'cash' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if method is invalid', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: order._id.toString(), amount: 10000, method: 'barter' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 if order does not exist', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .post('/api/payments')
        .set(authHeader(staffToken))
        .send({ orderId: '64f1a2b3c4d5e6f7a8b9c0d1', amount: 10000, method: 'cash' });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/payments
  // ─────────────────────────────────────────────

  describe('GET /api/payments', () => {
    it('staff can list payments for their branch', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);
      await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .get('/api/payments')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports filtering by isFlagged', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);
      await createPayment(order, customer, branch, staff, { isFlagged: true });

      const res = await request(app)
        .get('/api/payments?isFlagged=true')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.every((p) => p.isFlagged === true)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/payments/order/:orderId
  // ─────────────────────────────────────────────

  describe('GET /api/payments/order/:orderId', () => {
    it('should return payments for a specific order', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order = await createOrder(customer, branch, staff);
      await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .get(`/api/payments/order/${order._id}`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].amount).toBe(10000);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/payments/:id/receipt
  // ─────────────────────────────────────────────

  describe('GET /api/payments/:id/receipt', () => {
    it('should return receipt data for a payment', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order   = await createOrder(customer, branch, staff);
      const payment = await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .get(`/api/payments/${payment._id}/receipt`)
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.receiptNumber).toBe(payment.receiptNumber);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.customer).toBeDefined();
      expect(res.body.data.payment.amount).toBe(10000);
    });
  });

  // ─────────────────────────────────────────────
  //  PATCH /api/payments/:id/flag
  // ─────────────────────────────────────────────

  describe('PATCH /api/payments/:id/flag', () => {
    it('branch manager can flag a payment', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order   = await createOrder(customer, branch, staff);
      const payment = await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .patch(`/api/payments/${payment._id}/flag`)
        .set(authHeader(managerToken))
        .send({ isFlagged: true, flagReason: 'Suspected undercharge' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isFlagged).toBe(true);
      expect(res.body.data.flagReason).toBe('Suspected undercharge');
    });

    it('should return 400 if flagging without a reason', async () => {
      const { managerToken, customer, branch, staff } = await seedContext();
      const order   = await createOrder(customer, branch, staff);
      const payment = await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .patch(`/api/payments/${payment._id}/flag`)
        .set(authHeader(managerToken))
        .send({ isFlagged: true }); // no flagReason

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/reason/i);
    });

    it('staff cannot flag payments', async () => {
      const { staffToken, customer, branch, staff } = await seedContext();
      const order   = await createOrder(customer, branch, staff);
      const payment = await createPayment(order, customer, branch, staff);

      const res = await request(app)
        .patch(`/api/payments/${payment._id}/flag`)
        .set(authHeader(staffToken))
        .send({ isFlagged: true, flagReason: 'Test' });

      expect(res.statusCode).toBe(403);
    });
  });
});