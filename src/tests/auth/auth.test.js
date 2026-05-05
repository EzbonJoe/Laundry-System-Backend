const request = require('supertest');
const app     = require('../testApp');
const { createHQAdmin, createUser, createBranch, seedContext, authHeader } = require('../helpers');

describe('AUTH ROUTES', () => {

  // ─────────────────────────────────────────────
  //  POST /api/auth/login
  // ─────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return a token', async () => {
      await createHQAdmin(); // creates admin@ezbon.com style email
      const admin = await require('../../models/User').User.findOne({ role: 'hq_admin' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'password1' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined(); // never expose password
    });

    it('should return 401 with wrong password', async () => {
      await createHQAdmin();
      const admin = await require('../../models/User').User.findOne({ role: 'hq_admin' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'wrongpassword' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@ezbon.com', password: 'password1' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password1' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/email/i);
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@ezbon.com' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 for a deactivated account', async () => {
      const  { User }  = require('../../models/User');
      const admin = await createHQAdmin();
      await User.findByIdAndUpdate(admin._id, { isActive: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'password1' });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/deactivated/i);
    });
  });

  // ─────────────────────────────────────────────
  //  GET /api/auth/me
  // ─────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const { adminToken, admin } = await seedContext();

      const res = await request(app)
        .get('/api/auth/me')
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.email).toBe(admin.email);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 if token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set(authHeader('invalid.token.here'));

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────
  //  POST /api/auth/register
  // ─────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('HQ admin can register a new staff member', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/auth/register')
        .set(authHeader(adminToken))
        .send({
          name:     'New Staff',
          email:    'newstaff@ezbon.com',
          password: 'password1',
          role:     'staff',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.user.role).toBe('staff');
    });

    it('should return 400 if email already exists', async () => {
      const { adminToken, branch, staff } = await seedContext();

      const res = await request(app)
        .post('/api/auth/register')
        .set(authHeader(adminToken))
        .send({
          name:     'Duplicate',
          email:    staff.email,
          password: 'password1',
          role:     'staff',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should return 400 if password has no number', async () => {
      const { adminToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/auth/register')
        .set(authHeader(adminToken))
        .send({
          name:     'Bad Pass',
          email:    'badpass@ezbon.com',
          password: 'noNumbers',
          role:     'staff',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/number/i);
    });

    it('should return 400 if branch missing for staff role', async () => {
      const { adminToken } = await seedContext();

      const res = await request(app)
        .post('/api/auth/register')
        .set(authHeader(adminToken))
        .send({
          name:     'No Branch Staff',
          email:    'nobranch@ezbon.com',
          password: 'password1',
          role:     'staff',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/branch/i);
    });

    it('should return 403 if staff tries to register someone', async () => {
      const { staffToken, branch } = await seedContext();

      const res = await request(app)
        .post('/api/auth/register')
        .set(authHeader(staffToken))
        .send({
          name:     'Unauthorised',
          email:    'unauth@ezbon.com',
          password: 'password1',
          role:     'staff',
          branch:   branch._id.toString(),
        });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  //  PUT /api/auth/change-password
  // ─────────────────────────────────────────────

  describe('PUT /api/auth/change-password', () => {
    it('should change password with correct current password', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .put('/api/auth/change-password')
        .set(authHeader(staffToken))
        .send({ currentPassword: 'password1', newPassword: 'newpass2' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 401 with wrong current password', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .put('/api/auth/change-password')
        .set(authHeader(staffToken))
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass2' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 if new password has no number', async () => {
      const { staffToken } = await seedContext();

      const res = await request(app)
        .put('/api/auth/change-password')
        .set(authHeader(staffToken))
        .send({ currentPassword: 'password1', newPassword: 'nonumbers' });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  //  POST /api/auth/logout
  // ─────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('should return 200 on logout', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.statusCode).toBe(200);
    });
  });
});