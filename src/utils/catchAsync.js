// ─────────────────────────────────────────────
//  CATCH ASYNC
//  Wraps async controller functions so unhandled
//  promise rejections are passed to Express's
//  global error handler automatically.
//
//  Usage:
//    exports.createOrder = catchAsync(async (req, res, next) => { ... });
// ─────────────────────────────────────────────

const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;