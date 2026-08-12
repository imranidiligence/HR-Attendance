const successResponse = (res, statusCode, message, data) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const paginatedResponse = (res, statusCode, message, data, pagination) => {
  return res.status(statusCode).json({ success: true, message, data, pagination });
};

const errorResponse = (res, statusCode, message, error) => {
  return res.status(statusCode).json({ success: false, message, error: error || null });
};

// Translates common Postgres error codes into clean API responses.
// 23503 = foreign_key_violation, 23505 = unique_violation
const handleDbError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  if (error.code === '23503') {
    return errorResponse(
      res,
      400,
      'Invalid reference: related record does not exist',
      error.detail || error.message
    );
  }

  if (error.code === '23505') {
    return errorResponse(
      res,
      409,
      'Duplicate record: value already exists',
      error.detail || error.message
    );
  }

  return errorResponse(res, 500, fallbackMessage, error.message);
};

module.exports = { successResponse, paginatedResponse, errorResponse, handleDbError };