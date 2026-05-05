// A stripped-down version of server.js for testing.
// Does NOT call connectDB or app.listen — setup.js handles the DB.
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_12345';
process.env.NODE_ENV   = 'test';
const express        = require('express');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const { errorHandler } = require('../middleware/errorHandler');
const { AppError }     = require('../middleware/errorHandler');
const authRoutes         = require('../routes/authRoutes');
const userRoutes         = require('../routes/userRoutes');
const branchRoutes       = require('../routes/branchRoutes');
const customerRoutes     = require('../routes/customerRoutes');
const orderRoutes        = require('../routes/orderRoutes');
const paymentRoutes      = require('../routes/paymentRoutes');
const inventoryRoutes    = require('../routes/inventoryRoutes');
const machineRoutes      = require('../routes/machineRoutes');
const expenseRoutes      = require('../routes/expenseRoutes');
const reportRoutes       = require('../routes/reportRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const auditLogRoutes     = require('../routes/auditLogRoutes');
const feedbackRoutes     = require('../routes/feedbackRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Safe mongo sanitizer — strips $ and . keys without reassigning req.query
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  };
  sanitize(req.body);
  sanitize(req.params);
  next();
});

const API = '/api';
app.use(`${API}/auth`,           authRoutes);
app.use(`${API}/users`,          userRoutes);
app.use(`${API}/branches`,       branchRoutes);
app.use(`${API}/customers`,      customerRoutes);
app.use(`${API}/orders`,         orderRoutes);
app.use(`${API}/payments`,       paymentRoutes);
app.use(`${API}/inventory`,      inventoryRoutes);
app.use(`${API}/machines`,       machineRoutes);
app.use(`${API}/expenses`,       expenseRoutes);
app.use(`${API}/reports`,        reportRoutes);
app.use(`${API}/notifications`,  notificationRoutes);
app.use(`${API}/audit-logs`,     auditLogRoutes);
app.use(`${API}/feedback`,       feedbackRoutes);
app.all('*splat', (req, res, next) =>
  next(new AppError(`Route ${req.originalUrl} not found`, 404))
);
app.use(errorHandler);
module.exports = app;