// ─────────────────────────────────────────────
//  CUSTOM APP ERROR CLASS
// ─────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true; // distinguishes our errors from unexpected crashes

    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────────
//  ERROR HANDLER MIDDLEWARE
// ─────────────────────────────────────────────

// Handle MongoDB cast errors (e.g. invalid ObjectId)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle MongoDB duplicate field errors
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate value "${value}" for field "${field}". Please use a different value.`;
  return new AppError(message, 400);
};

// Handle Mongoose validation errors
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle expired JWT
const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

// Handle invalid JWT
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

// Development: send full error details
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// Production: only send safe, operational errors to client
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Unexpected/programming error — don't leak details
    console.error('💥 UNEXPECTED ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

// ─────────────────────────────────────────────
//  MAIN ERROR HANDLER (express 4-arg middleware)
// ─────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // ✅ FIX: preserve the original error's prototype chain and key properties
    // { ...err } on an Error object strips prototype, losing .name, .isOperational, etc.
    let error = err;

    if (err.name === 'CastError')         error = handleCastErrorDB(err);
    if (err.code === 11000)               error = handleDuplicateFieldsDB(err);
    if (err.name === 'ValidationError')   error = handleValidationErrorDB(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = { AppError, errorHandler };