/* eslint-disable */

// ==============================
// UNCAUGHT EXCEPTION HANDLER
// ==============================
// Must be declared at the very top to catch any synchronous bugs.
// Handles bugs that occur entirely outside of asynchronous Promise chains.

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);

  // Exit process immediately with status code 1 (failure)
  process.exit(1);
});

// ==============================
// IMPORTS
// ==============================
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables before requiring the app
dotenv.config({ path: './config.env' });
const app = require('./app');

/*
|--------------------------------------------------------------------------
| SERVER INITIALIZATION
|--------------------------------------------------------------------------
| Entry point of the application. Handles database connection, server startup,
| and global unhandled exception/rejection safety nets.
*/

// ==============================
// DATABASE CONNECTION
// ==============================

// Replace connection string password placeholder with the real secret
const db = process.env.DATABASE.replace(
  '<db_password>',
  process.env.DATABASE_PASSWORD,
);

// Connect to MongoDB using Mongoose
mongoose
  .connect(db)
  .then(() => console.log('DB Connection Successful!'))
  .catch((err) => {
    console.log('Database connection failed:', err.message);
    process.exit(1); // Force exit if DB connection fails
  });

// ==============================
// SERVER STARTUP
// ==============================

// Extract port from environment or fallback to 3000
const port = process.env.PORT || 3000;

// Initialize the HTTP listener server
const server = app.listen(port, () =>
  console.log(`Started listening on port ${port}!`),
);

// ==============================
// UNHANDLED REJECTION HANDLER
// ==============================
// Handles asynchronous Promise rejections that were not caught natively.
// Crucial for capturing delayed database timeouts or network connection failures.

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);

  // Shut down the server gracefully to finish pending requests before exiting
  server.close(() => {
    // Exit process with status code 1 (failure)
    process.exit(1);
  });
});

// ==============================
// SIGTERM HANDLER
// ==============================
// Handles platform shutdown signals, such as deploy restarts or container stops.
// SIGTERM already tells the Node.js process to terminate, so we only close the
// server gracefully here instead of calling process.exit() inside server.close().

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');

  server.close(() => {
    console.log('Process terminated!');
  });
});
