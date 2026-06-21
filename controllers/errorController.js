// ==============================
// IMPORTS
// ==============================

const AppError = require('../utils/appError');

/*
|--------------------------------------------------------------------------
| ERROR HANDLING MIDDLEWARE
|--------------------------------------------------------------------------
| Central error handling system for the application.
| Processes errors differently based on environment (dev vs production).
*/

// ==============================
// DATABASE ERROR HANDLERS
// ==============================

// ==============================
// 1. HANDLE INVALID MONGODB ID ERRORS
// ==============================
// Catches errors when an invalid MongoDB ObjectId is used
// Example: GET /api/v1/tours/123abc (invalid 24-char hex string)

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// ==============================
// 2. HANDLE DUPLICATE FIELD ERRORS
// ==============================
// Catches MongoDB unique constraint violations
// Example: Creating a tour with a name that already exists
// Error code: 11000

const handleDuplicateFieldsDB = (err) => {
  // Extract the duplicate value from error
  const value = err.keyValue.name;

  const message = `Duplicate field value: ${value}. Please use another value`;

  return new AppError(message, 400);
};

// ==============================
// 3. HANDLE VALIDATION ERRORS
// ==============================
// Catches Mongoose schema validation errors
// Example: Missing required field, invalid enum value, minlength violation

const handleValidationErrorDB = (err) => {
  // err.errors is an object containing validation errors for each field
  // Convert it to an array of error messages
  const errors = Object.values(err.errors).map((el) => el.message);

  // Join all error messages into a single readable string
  const message = `Invalid input data: ${errors.join('. ')}`;

  return new AppError(message, 400);
};

// ==============================
// 4. HANDLE JWT VERIFICATION ERRORS
// ==============================
// Catches errors when JWT token is invalid or corrupted

const handleJWTError = () =>
  new AppError('Invalid token. Please login again', 401);

// ==============================
// 5. HANDLE MULTER ERRORS
// ==============================
// Catches errors during file upload using multer

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Please upload a smaller image.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Too many files or wrong field name.', 400);
  }
  return new AppError('File upload error.', 400);
};

// ==============================
// 6. HANDLE JWT EXPIRATION ERRORS
// ==============================
// Catches errors when JWT token has expired

const handleJWTExpiredError = () =>
  new AppError('Token has expired.Please login again', 401);

// ==============================
// DEVELOPMENT ERROR RESPONSE
// ==============================
// In development, provide detailed error information for debugging

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    // Error status: 'fail' (client error) or 'error' (server error)
    status: err.status,

    // Human-readable error message
    message: err.message,

    // Full stack trace showing where the error occurred
    // Helps developers identify the bug location
    stack: err.stack,

    // Complete error object with all properties
    error: err,
  });
};

// ==============================
// PRODUCTION ERROR RESPONSE
// ==============================
// In production, send minimal error info to prevent leaking implementation details

const sendErrorProd = (err, res) => {
  // ==============================
  // OPERATIONAL ERRORS
  // ==============================
  // These are trusted errors intentionally created by the application
  // Examples:
  // - Invalid request data
  // - Resource not found
  // - Validation failures
  // - Authentication/Authorization issues
  //
  // Send specific error message to client

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  // ==============================
  // PROGRAMMING ERRORS
  // ==============================
  // These are unexpected errors caused by bugs in the code
  // Examples:
  // - Undefined variables
  // - Type errors
  // - Logic errors
  //
  // DO NOT expose internal details to client
  else {
    // 1) Log full error internally for debugging
    console.error('Error:', err);

    // 2) Send generic response to client
    // Prevents exposing internal implementation details
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!!',
    });
  }
};

// ==============================
// GLOBAL ERROR MIDDLEWARE
// ==============================
// Express automatically calls this middleware whenever next(err) is invoked
// This is the central error handling hub for the entire application
//
// Middleware signature with 4 parameters tells Express this is an error handler:
// (err, req, res, next) => ...

module.exports = (err, req, res, next) => {
  // Set default HTTP status code if not provided
  err.statusCode = err.statusCode || 500;

  // Set default error status ('fail' or 'error')
  err.status = err.status || 'error';

  // ==============================
  // DEVELOPMENT ENVIRONMENT
  // ==============================
  // Send complete error details for debugging

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  }

  // ==============================
  // PRODUCTION ENVIRONMENT
  // ==============================
  // Send safe/minimal error information, handle specific error types
  else if (process.env.NODE_ENV === 'production') {
    // Create shallow copy of error object
    // Note: Error properties like name/message are non-enumerable,
    // so they must be explicitly copied to preserve them
    let error = { ...err };

    // Manually copy non-enumerable properties
    error.name = err.name;
    error.message = err.message;

    // ==============================
    // CONVERT ERRORS TO OPERATIONAL ERRORS
    // ==============================

    // Handle invalid MongoDB ObjectIds
    if (error.name === 'CastError') {
      error = handleCastErrorDB(error);
    }

    // Handle duplicate MongoDB field constraint violations
    if (error.code === 11000) {
      error = handleDuplicateFieldsDB(error);
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }

    // Handle JWT verification errors
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }

    // Handle JWT expiration errors
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }
    if (error.name === 'MulterError') {
      error = handleMulterError(error);
    }

    // Send final production-safe response
    sendErrorProd(error, res);
  }
};
