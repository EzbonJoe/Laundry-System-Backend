// ─────────────────────────────────────────────
//  API RESPONSE HELPERS
//  Ensures every response follows the same shape
// ─────────────────────────────────────────────

/**
 * Send a success response.
 *
 * @param {Object}  res
 * @param {number}  statusCode  - HTTP status (default 200)
 * @param {string}  message     - Human-readable message
 * @param {*}       data        - The response payload
 * @param {Object}  meta        - Optional pagination or extra info
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = {
    status: 'success',
    message,
    data,
  };

  if (meta) response.meta = meta;

  return res.status(statusCode).json(response);
};

/**
 * Send a paginated list response.
 *
 * @param {Object} res
 * @param {Array}  results   - Array of documents
 * @param {number} total     - Total count before pagination
 * @param {number} page      - Current page number
 * @param {number} limit     - Items per page
 */
const sendPaginated = (res, results, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    status: 'success',
    message: 'Data retrieved successfully',
    data: results,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
};

/**
 * Parse pagination query params from request.
 * Usage: const { page, limit, skip } = getPagination(req);
 */
const getPagination = (req) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = { sendSuccess, sendPaginated, getPagination };