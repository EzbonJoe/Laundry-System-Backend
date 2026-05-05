const request = require('supertest');
const app     = require('../testApp');
const { seedContext, createInventoryItem, createOrder, authHeader } = require('../helpers');

describe('INVENTORY ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/inventory
  // ─────────────────────────────────────────────

  describe('POST /api/inventory', () => {
    it('branch manager can add an inventory item', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/inventory')
        .set(authHeader(managerToken))
        .send({
          name:              'Ariel Detergent',
          category:          'detergent',
          unit:              'kg',
          currentStock:      30,
          minimumStockLevel: 5,
          branch:            branch._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('Ariel Detergent');
    });

    it('should return 400 if category is invalid', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/inventory')
        .set(authHeader(managerToken))
        .send({
          name:              'Mystery Item',
          category:          'unknown_category',
          unit:              'kg',
          currentStock:      10,
          minimumStockLevel: 2,
          branch:            branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if unit is missing', async () => {
      const { managerToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/inventory')
        .set(authHeader(managerToken))
        .send({
          name:              'No Unit Item',
          category:          'detergent',
          currentStock:      10,
          minimumStockLevel: 2,
          branch:            branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/unit/i);
    });

    it('staff cannot add inventory items', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/inventory')
        .set(authHeader(staffToken))
        .send({
          name:     'Staff Item',
          category: 'detergent',
          unit:     'kg',
          currentStock: 10,
          minimumStockLevel: 2,
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/inventory
  // ─────────────────────────────────────────────

  describe('GET /api/inventory', () => {
    it('should return inventory for user branch', async () => {
      const { staffToken, branch } = await seedContext();
      await createInventoryItem(branch);

      const res = await request(app)
        .get('/api/inventory')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('supports filtering by isLowStock', async () => {
      const { staffToken, branch } = await seedContext();
      await createInventoryItem(branch, { currentStock: 2, minimumStockLevel: 5 }); // low stock

      const res = await request(app)
        .get('/api/inventory?isLowStock=true')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.every((i) => i.isLowStock === true)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/inventory/alerts/low-stock
  // ─────────────────────────────────────────────

  describe('GET /api/inventory/alerts/low-stock', () => {
    it('should return only low stock items', async () => {
      const { staffToken, branch } = await seedContext();
      await createInventoryItem(branch, { currentStock: 1, minimumStockLevel: 10 });

      const res = await request(app)
        .get('/api/inventory/alerts/low-stock')
        .set(authHeader(staffToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((i) => i.isLowStock)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  //  PATCH /api/inventory/:id/stock
  // ─────────────────────────────────────────────

  describe('PATCH /api/inventory/:id/stock', () => {
    it('manager can manually update stock level', async () => {
      const { managerToken, branch } = await seedContext();
      const item = await createInventoryItem(branch);

      const res = await request(app)
        .patch(`/api/inventory/${item._id}/stock`)
        .set(authHeader(managerToken))
        .send({ currentStock: 50 });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.currentStock).toBe(50);
    });

    it('should return 400 if no fields provided', async () => {
      const { managerToken, branch } = await seedContext();
      const item = await createInventoryItem(branch);

      const res = await request(app)
        .patch(`/api/inventory/${item._id}/stock`)
        .set(authHeader(managerToken))
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  //  POST /api/inventory/:id/use
  // ─────────────────────────────────────────────

  describe('POST /api/inventory/:id/use', () => {
    it('staff can log stock usage', async () => {
      const { staffToken, branch, customer, staff } = await seedContext();
      const item  = await createInventoryItem(branch, { currentStock: 20 });
      const order = await createOrder(customer, branch, staff);

      const res = await request(app)
        .post(`/api/inventory/${item._id}/use`)
        .set(authHeader(staffToken))
        .send({ quantityUsed: 3, orderId: order._id.toString() });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.updatedItem.currentStock).toBe(17); // 20 - 3
    });

    it('should return 400 if usage exceeds current stock', async () => {
      const { staffToken, branch } = await seedContext();
      const item = await createInventoryItem(branch, { currentStock: 2 });

      const res = await request(app)
        .post(`/api/inventory/${item._id}/use`)
        .set(authHeader(staffToken))
        .send({ quantityUsed: 10 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/insufficient/i);
    });

    it('should return 400 if quantityUsed is 0', async () => {
      const { staffToken, branch } = await seedContext();
      const item = await createInventoryItem(branch);

      const res = await request(app)
        .post(`/api/inventory/${item._id}/use`)
        .set(authHeader(staffToken))
        .send({ quantityUsed: 0 });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  //  POST /api/inventory/:id/restock
  // ─────────────────────────────────────────────

  describe('POST /api/inventory/:id/restock', () => {
    it('manager can restock an item', async () => {
      const { managerToken, branch } = await seedContext();
      const item = await createInventoryItem(branch, { currentStock: 5 });

      const res = await request(app)
        .post(`/api/inventory/${item._id}/restock`)
        .set(authHeader(managerToken))
        .send({ quantityAdded: 20, supplier: 'Nakumatt', cost: 50000 });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.updatedItem.currentStock).toBe(25); // 5 + 20
    });

    it('should return 400 if quantityAdded is 0', async () => {
      const { managerToken, branch } = await seedContext();
      const item = await createInventoryItem(branch);

      const res = await request(app)
        .post(`/api/inventory/${item._id}/restock`)
        .set(authHeader(managerToken))
        .send({ quantityAdded: 0 });

      expect(res.statusCode).toBe(400);
    });

    it('staff cannot restock items', async () => {
      const { staffToken, branch } = await seedContext();
      const item = await createInventoryItem(branch);

      const res = await request(app)
        .post(`/api/inventory/${item._id}/restock`)
        .set(authHeader(staffToken))
        .send({ quantityAdded: 10 });

      expect(res.statusCode).toBe(403);
    });
  });
});