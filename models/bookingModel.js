// ==============================
// IMPORTS
// ==============================

const mongoose = require('mongoose');

/*
|--------------------------------------------------------------------------
| BOOKING SCHEMA & MODEL DEFINITION
|--------------------------------------------------------------------------
| Defines the structural blueprint, validation rules, relationships,
| and query hooks for user program bookings.
*/

// ==============================
// BOOKING SCHEMA
// ==============================

const bookingSchema = new mongoose.Schema({
  // ==============================
  // RELATIONSHIPS / REFERENCES
  // ==============================

  program: {
    type: mongoose.Schema.ObjectId,
    ref: 'Program',
    required: [true, 'Booking must belong to a Program!'],
  },

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a User!'],
  },

  // ==============================
  // PRICING & TRANSACTION DATA
  // ==============================

  price: {
    type: Number,
    required: [true, 'Booking must have a price.'],
  },
  paid: {
    type: Boolean,
    default: true,
  },

  // ==============================
  // METADATA
  // ==============================

  createdAt: {
    type: Date,
    default: Date.now, // Automatically records the moment the booking is created
  },
});

// ==============================
// QUERY MIDDLEWARE (PRE-FIND)
// ==============================
// Automatically populate referenced documents whenever a booking is queried

bookingSchema.pre(/^find/, function () {
  // `this` points to the current query object
  // Chain populates to resolve both the full user document and the specific program name
  this.populate('user').populate({
    path: 'program',
    select: 'name duration category',
  });
});

// ==============================
// MODEL CREATION
// ==============================

const Booking = mongoose.model('Booking', bookingSchema);

// ==============================
// EXPORT
// ==============================

module.exports = Booking;
