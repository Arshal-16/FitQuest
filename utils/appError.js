// ==============================
// CUSTOM ERROR CLASS
// ==============================
// AppError is a custom error class used for operational errors
// (errors that we can anticipate and handle gracefully).
//
// Operational errors include:
// - Invalid input data
// - Authentication failures
// - Resource not found (404)
// - Authorization failures (403)
//
// Non-operational errors (bugs in code) are handled differently
// and are not extended from AppError.

class AppError extends Error {
  // Constructor initializes the error with message and HTTP status code
  constructor(message, statusCode) {
    super(message);

    // HTTP status code (e.g., 404, 400, 500)
    this.statusCode = statusCode;

    // Determine error status based on status code
    // Status codes starting with '4' are client errors (fail)
    // Status codes starting with '5' are server errors (error)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Flag to identify this as an operational error
    // Used to distinguish from programming errors
    this.isOperational = true;

    // Capture stack trace for debugging
    // Excludes this constructor from the stack trace output
    Error.captureStackTrace(this, this.constructor);
  }
}

// ==============================
// EXPORT
// ==============================

module.exports = AppError;
