// ==============================
// IMPORTS
// ==============================

const mongoose = require('mongoose');
const Program = require('./programModel');

/*
|--------------------------------------------------------------------------
| REVIEW SCHEMA & MODEL DEFINITION
|--------------------------------------------------------------------------
| Defines the structural blueprint, validation rules, static methods for
| average rating calculations, and query hooks for program reviews.
*/

// ==============================
// REVIEW SCHEMA
// ==============================

const reviewSchema = new mongoose.Schema(
  {
    // ==============================
    // CORE REVIEW CONTENT
    // ==============================

    review: {
      type: String,
      required: [true, 'Review cannot be empty!'],
    },

    rating: {
      type: Number,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      required: [true, 'Review must have a rating'],
    },

    // ==============================
    // METADATA
    // ==============================

    createdAt: {
      type: Date,
      default: Date.now, // Automatically saves the exact moment of review creation
    },

    // ==============================
    // RELATIONSHIPS / REFERENCES
    // ==============================

    program: {
      type: mongoose.Schema.ObjectId,
      ref: 'Program',
      required: [true, 'Review must belong to a program'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },

  // ==============================
  // SCHEMA OPTIONS
  // ==============================
  // Configure how documents are serialized to JSON/Object
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ==============================
// INDEXES
// ==============================
// Database indexing optimizations and constraints

// Prevent one user from reviewing the same program multiple times
// 1 specifies ascending order for the compound index
reviewSchema.index({ program: 1, user: 1 }, { unique: true });

// ==============================
// QUERY MIDDLEWARE (PRE-FIND)
// ==============================
// Populate user details whenever reviews are queried using any 'find' method

reviewSchema.pre(/^find/, function () {
  // `this` points to the current query
  this.populate({
    path: 'user',
    select: 'name photo',
  });
});

// ==============================
// STATIC METHODS
// ==============================

// Calculate average rating and total ratings for a specific program
reviewSchema.statics.calcAverageRatings = async function (programId) {
  // Execute aggregation pipeline on the Review model itself
  const stats = await this.aggregate([
    {
      // STAGE 1: FILTER
      // Match all reviews that belong to the current target program
      $match: { program: programId },
    },
    {
      // STAGE 2: GROUP
      // Calculate the total number of ratings and the mathematical average rating score
      $group: {
        _id: '$program',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  // If reviews exist for the program, update the Program document with calculated stats
  if (stats.length > 0) {
    await Program.findByIdAndUpdate(programId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    // Default fallback values when no reviews exist for the program
    await Program.findByIdAndUpdate(programId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// ==============================
// DOCUMENT MIDDLEWARE (POST-SAVE)
// ==============================
// Recalculate ratings immediately after saving a new review to the database

reviewSchema.post('save', async function () {
  // `this.constructor` points to the current Review model instance
  await this.constructor.calcAverageRatings(this.program);
});

// ==============================
// QUERY MIDDLEWARE (UPDATE & DELETE HOOKS)
// ==============================
// Handles recalculations for routes using findOneAndUpdate or findOneAndDelete

// PRE-HOOK: Store the review document state before update/delete operations execute
reviewSchema.pre(/^findOneAnd/, async function () {
  // Execute query to get the current document and attach it to the query object (`this.r`)
  this.r = await this.findOne();
});

// POST-HOOK: Recalculate ratings after update/delete operations have committed
reviewSchema.post(/^findOneAnd/, async function () {
  // Retrieve the program ID from the saved document reference (`this.r`)
  // and trigger the static calculation method

  // Safety check:
  // If no review document was found by findOneAndUpdate/findOneAndDelete,
  // `this.r` will be null. Attempting to access `this.r.constructor`
  // or `this.r.program` would throw a runtime error.
  if (this.r) {
    await this.r.constructor.calcAverageRatings(this.r.program);
  }
});

// ==============================
// MODEL CREATION
// ==============================

const Review = mongoose.model('Review', reviewSchema);

// ==============================
// EXPORT
// ==============================

module.exports = Review;
