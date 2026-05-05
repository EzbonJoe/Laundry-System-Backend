const jwt = require('jsonwebtoken');
const { User }  = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { createAuditLog } = require('../middleware/auditMiddleware');

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenResponse = (user, statusCode, message, res) => {
  const token = signToken(user._id);

  // Send token as http-only cookie
  const cookieOptions = {
    expires: new Date(
      Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN) || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  sendSuccess(res, statusCode, message, { token, user });
};

// ─────────────────────────────────────────────
//  REGISTER
// ─────────────────────────────────────────────

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role, branch, phone } = req.body;

  // Only hq_admin can create branch_manager or another hq_admin
  // Staff accounts can be created by branch_manager too (enforced in route middleware)
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('A user with this email already exists.', 400));
  }

  const newUser = await User.create({ name, email, password, role, branch, phone });

  await createAuditLog({
    action:      'CREATE_USER',
    entity:      'User',
    entityId:    newUser._id,
    performedBy: req.user._id,
    branch:      newUser.branch,
    after:       { name: newUser.name, email: newUser.email, role: newUser.role },
    ipAddress:   req.ip,
    description: `${req.user.name} created user ${newUser.name} with role ${newUser.role}`,
  });

  sendTokenResponse(newUser, 201, 'User registered successfully', res);
});

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password.', 400));
  }

  // Fetch user with password field (select: false by default)
  const user = await User.findOne({ email })
    .select('+password')
    .populate('branch', 'name location isActive');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Contact your administrator.', 401));
  }

  // Update last login timestamp
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  await createAuditLog({
    action:      'LOGIN',
    entity:      'User',
    entityId:    user._id,
    performedBy: user._id,
    branch:      user.branch?._id,
    ipAddress:   req.ip,
    description: `${user.name} logged in`,
  });

  sendTokenResponse(user, 200, 'Logged in successfully', res);
});

// ─────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────

exports.logout = catchAsync(async (req, res, next) => {
  // Clear the JWT cookie
  res.cookie('jwt', 'logged_out', {
    expires:  new Date(Date.now() + 1000),
    httpOnly: true,
  });

  sendSuccess(res, 200, 'Logged out successfully');
});

// ─────────────────────────────────────────────
//  GET CURRENT USER
// ─────────────────────────────────────────────

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('branch', 'name location');

  sendSuccess(res, 200, 'User profile retrieved', user);
});

// ─────────────────────────────────────────────
//  CHANGE PASSWORD
// ─────────────────────────────────────────────

exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password.', 400));
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Your current password is incorrect.', 401));
  }

  if (newPassword.length < 6) {
    return next(new AppError('New password must be at least 6 characters.', 400));
  }

  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  await createAuditLog({
    action:      'CHANGE_PASSWORD',
    entity:      'User',
    entityId:    user._id,
    performedBy: user._id,
    ipAddress:   req.ip,
    description: `${user.name} changed their password`,
  });

  sendTokenResponse(user, 200, 'Password changed successfully', res);
});

// ─────────────────────────────────────────────
//  RESET PASSWORD (HQ Admin resets for a user)
// ─────────────────────────────────────────────

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return next(new AppError('Please provide userId and newPassword.', 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found.', 404));

  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  await createAuditLog({
    action:      'RESET_PASSWORD',
    entity:      'User',
    entityId:    user._id,
    performedBy: req.user._id,
    ipAddress:   req.ip,
    description: `${req.user.name} reset password for ${user.name}`,
  });

  sendSuccess(res, 200, `Password reset successfully for ${user.name}`);
});