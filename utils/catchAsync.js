// ==============================
// CATCH ASYNC ERROR WRAPPER
// ==============================
// This is a higher-order function (middleware) that wraps async Express route handlers.
// It catches any errors thrown in async functions and passes them to the global error handler.
//
// Why is this needed?
// Express does NOT automatically catch errors thrown in async functions.
// Without this wrapper, unhandled promise rejections would crash the app.
//
// How it works:
// 1. Takes an async function as input (the route handler)
// 2. Returns a new middleware function
// 3. When middleware runs, it executes the original async function
// 4. If the function rejects/throws, .catch() catches it
// 5. Error is passed to Express via next(err)
// 6. Express forwards it to the global error handler middleware

// ==============================
// EXPORT
// ==============================

module.exports =
  (fn) =>
    // Return a new middleware function for Express
    async (req, res, next) => {
      // Execute the original async route handler function
      // Since async functions return a Promise,
      // we can attach .catch() to handle rejected promises/errors
      fn(req, res, next).catch((err) => {
        // Pass any error to Express global error handling middleware
        // Express will automatically call the global error handler
        next(err);
      });
    };
