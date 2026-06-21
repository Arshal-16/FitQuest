const express = require('express');
const bookingController = require('./../controllers/bookingController');
const authController = require('./../controllers/authController');

/*
|--------------------------------------------------------------------------
| BOOKING ROUTES
|--------------------------------------------------------------------------
| Configures checkout access for logged-in users and booking management
| endpoints reserved for administrators.
*/

// ==============================
// ROUTER SETUP
// ==============================

const router = express.Router();

// ==============================
// AUTHENTICATION GUARD
// ==============================
// All booking routes require a logged-in user before any route-specific logic runs

router.use(authController.protect);

// ==============================
// CHECKOUT SESSION ROUTE
// ==============================
// Starts Stripe Checkout for the selected program
// GET /api/v1/bookings/checkout-session/:programId

router.get(
  '/checkout-session/:programId',
  bookingController.getCheckoutSession,
);

// ==============================
// ADMIN-ONLY BOOKING MANAGEMENT
// ==============================
// Routes below this middleware are restricted to administrators

router.use(authController.restrictTo('admin'));

// ==============================
// ROOT ROUTE — /api/v1/bookings
// ==============================
// GET  — list all bookings
// POST — manually create a booking

router
  .route('/')
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

// ==============================
// INDIVIDUAL ROUTE — /api/v1/bookings/:id
// ==============================
// GET    — retrieve one booking
// PATCH  — update one booking
// DELETE — remove one booking

router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);

// ==============================
// EXPORT ROUTER
// ==============================

module.exports = router;
