const jwt = require('jsonwebtoken');
const  { User }  = require('../models/User');
const { AppError } = require('./errorHandler');

// ─────────────────────────────────────────────
//  PROTECT — Verify JWT & attach user to req
// ─────────────────────────────────────────────

const protect = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header or cookie
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id).populate('branch', 'name location isActive');

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4. Check if user is still active
    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact admin.', 401));
    }

    // 5. Check if user changed password after token was issued
    if (currentUser.passwordChangedAfter(decoded.iat)) {
      return next(new AppError('Your password was recently changed. Please log in again.', 401));
    }

    // 6. Attach user to request
    req.user = currentUser;
    next();

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
//  RESTRICT TO — Role-based access control
// ─────────────────────────────────────────────

/**
 * Usage: restrictTo('hq_admin', 'branch_manager')
 * Pass one or more allowed roles as arguments.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    next();
  };
};

// ─────────────────────────────────────────────
//  BRANCH ACCESS — Staff can only access their own branch
// ─────────────────────────────────────────────

/**
 * For routes that use :branchId param.
 * HQ admins can access any branch.
 * Branch managers and staff can only access their own.
 */
const restrictToBranch = (req, res, next) => {
  const { branchId } = req.params;

  if (req.user.role === 'hq_admin') {
    return next(); // HQ admin sees everything
  }

  if (!req.user.branch) {
    return next(new AppError('You are not assigned to any branch.', 403));
  }

  if (req.user.branch._id.toString() !== branchId) {
    return next(new AppError('You can only access data for your own branch.', 403));
  }

  next();
};

/**
 * Injects the user's branch into query if not HQ admin.
 * Use this on list routes to auto-filter by branch.
 * 
 * Example: GET /api/orders — staff only see their branch's orders.
 */
const injectBranchFilter = (req, res, next) => {
  if (req.user.role !== 'hq_admin') {
    req.branchFilter = { branch: req.user.branch._id };
  } else {
    req.branchFilter = {}; // no filter for HQ admin
  }
  next();
};

module.exports = { protect, restrictTo, restrictToBranch, injectBranchFilter };