require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dns        = require('dns');

const connectDB            = require('./src/config/db');
const { errorHandler }     = require('./src/middleware/errorHandler');
const { AppError }         = require('./src/middleware/errorHandler');

// ── Import Routes ────────────────────────────
const authRoutes       = require('./src/routes/authRoutes');
const userRoutes       = require('./src/routes/userRoutes');
const branchRoutes     = require('./src/routes/branchRoutes');
const customerRoutes   = require('./src/routes/customerRoutes');
const orderRoutes      = require('./src/routes/orderRoutes');
const paymentRoutes    = require('./src/routes/paymentRoutes');
const inventoryRoutes  = require('./src/routes/inventoryRoutes');
const machineRoutes    = require('./src/routes/machineRoutes');
const expenseRoutes    = require('./src/routes/expenseRoutes');
const reportRoutes     = require('./src/routes/reportRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const auditLogRoutes   = require('./src/routes/auditLogRoutes');
const feedbackRoutes   = require('./src/routes/feedbackRoutes');

// Try to set custom DNS servers, but fallback silently if it fails
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']); // Cloudflare + Google DNS
  console.log('Custom DNS servers set ✅');
} catch (err) {
  console.warn('Could not set custom DNS servers, using system defaults ⚠️');
}

// ─────────────────────────────────────────────
//  APP SETUP
// ─────────────────────────────────────────────

const app = express();

// ── Security Middleware ──────────────────────

// Set secure HTTP headers
app.use(helmet());

// CORS — allow requests from the frontend client
app.use(cors({
  origin: [
    // 'http://localhost:5173',
    'https://laundry-management-frontend.vercel.app',
  ],
  credentials: true, // allow cookies
}));

// Rate limiting — protect auth routes from brute force
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/auth', limiter);

// Sanitize data — prevent MongoDB operator injection
// Express 5 compatible sanitizer (replaces express-mongo-sanitize)
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    }
  };
  sanitize(req.body);
  sanitize(req.params);
  next();
});

// ── Request Parsing ──────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Logging ──────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─────────────────────────────────────────────
//  HEALTH CHECK
// ─────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    status:      'success',
    message:     'Ezbon API is running',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  API ROUTES
// ─────────────────────────────────────────────

const API = '/api';

app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/users`,         userRoutes);
app.use(`${API}/branches`,      branchRoutes);
app.use(`${API}/customers`,     customerRoutes);
app.use(`${API}/orders`,        orderRoutes);
app.use(`${API}/payments`,      paymentRoutes);
app.use(`${API}/inventory`,     inventoryRoutes);
app.use(`${API}/machines`,      machineRoutes); 
app.use(`${API}/expenses`,      expenseRoutes);
app.use(`${API}/reports`,       reportRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/audit-logs`,    auditLogRoutes);
app.use(`${API}/feedback`,      feedbackRoutes);
 
// ─────────────────────────────────────────────
//  UNHANDLED ROUTES
// ─────────────────────────────────────────────

app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found on this server.`, 404));
});

// ─────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Ezbon server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err.name, err.message);
    server.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.name, err.message);
    process.exit(1);
  });

  // Graceful shutdown on SIGTERM (e.g. from cloud host)
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('💤 Server closed.');
      process.exit(0);
    });
  });
};

startServer();