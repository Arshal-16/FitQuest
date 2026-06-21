// ==============================
// IMPORTS
// ==============================

const mongoose = require('mongoose');
const slugify = require('slugify');

/*
|--------------------------------------------------------------------------
| PROGRAM SCHEMA & MODEL DEFINITION
|--------------------------------------------------------------------------
| Defines the structural blueprint, data validation rules, geospatial indexes,
| virtual properties (including populates), and execution hooks for training programs.
*/

// ==============================
// PROGRAM SCHEMA
// ==============================

const programSchema = new mongoose.Schema(
  {
    // ==============================
    // BASIC PROGRAM INFORMATION
    // ==============================

    name: {
      type: String,
      required: [true, 'A program must have a name'],
      unique: true,
      trim: true,
      maxlength: [
        50,
        'A program name must have less or equal than 50 characters',
      ],
      minlength: [
        10,
        'A program name must have more or equal than 10 characters',
      ],
    },

    // URL-friendly string derived from the program name
    slug: String,

    duration: {
      type: Number,
      required: [true, 'A program must have a duration'],
      min: [1, 'Duration must be at least 1 week'],
    },

    sessionsPerWeek: {
      type: Number,
      required: [true, 'A program must specify sessions per week'],
      min: [1, 'Sessions per week must be at least 1'],
      max: [7, 'Sessions per week cannot exceed 7'],
    },

    maxGroupSize: {
      type: Number,
      required: [true, 'A program must have a group size'],
      min: [1, 'Group size must be at least 1'],
    },

    difficulty: {
      type: String,
      required: [true, 'A program must have a difficulty level'],
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Difficulty is either: beginner, intermediate, advanced',
      },
    },

    // ==============================
    // CATEGORIZATION & FORMAT
    // ==============================

    category: {
      type: String,
      required: [true, 'A program must have a category'],
      enum: {
        values: [
          'weight-loss',
          'strength',
          'cardio',
          'flexibility',
          'athletic',
          'rehabilitation',
        ],
        message:
          'Category must be: weight-loss, strength, cardio, flexibility, athletic, or rehabilitation',
      },
    },

    format: {
      type: String,
      enum: {
        values: ['in-person', 'online', 'hybrid'],
        message: 'Format must be: in-person, online, or hybrid',
      },
      default: 'in-person',
    },

    equipment: {
      type: String,
      enum: {
        values: ['none', 'minimal', 'full-gym'],
        message: 'Equipment must be: none, minimal, or full-gym',
      },
      default: 'full-gym',
    },

    // ==============================
    // RATINGS
    // ==============================

    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be at least 1.0'],
      max: [5, 'Rating must be at most 5.0'],
      // Setter function to round the value to 1 decimal place (e.g., 4.6666 -> 4.7)
      set: (val) => Math.round(val * 10) / 10,
    },

    ratingsQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Ratings quantity cannot be negative'],
    },

    // ==============================
    // PRICING
    // ==============================

    price: {
      type: Number,
      required: [true, 'A program must have a price'],
      min: [0, 'Price must be above 0'],
    },

    priceDiscount: {
      type: Number,
      validate: {
        // Custom validator: Works only on document creation (.create) and .save()
        validator: function (val) {
          return val == null || (val >= 0 && val < this.price);
        },
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },

    // ==============================
    // CONTENT & DESCRIPTIONS
    // ==============================

    summary: {
      type: String,
      trim: true,
      required: [true, 'A program must have a summary'],
    },

    description: {
      type: String,
      trim: true,
    },

    // ==============================
    // IMAGES
    // ==============================

    imageCover: {
      type: String,
      required: [true, 'A program must have a cover image'],
    },
    imageCoverPublicId: {
      type: String,
      select: false,
    },

    // Array of secondary image URL strings
    images: [String],

    imagesPublicIds: {
      type: [String],
      select: false,
    },

    // ==============================
    // STATUS
    // ==============================

    startDates: [Date],

    // ==============================
    // RELATIONSHIPS / REFERENCES
    // ==============================

    // Array referencing user documents explicitly assigned as trainers for this program
    trainers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },

  // ==============================
  // SCHEMA OPTIONS
  // ==============================
  // Configure serialization strategies to include virtual properties
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ==============================
// INDEXES
// ==============================
// Database indexing optimizations for faster query execution and constraints

// Compound index to optimize sorting/filtering by price and ratings
programSchema.index({ price: 1, ratingsAverage: -1 });

// Single index for fast URL slug lookups
programSchema.index({ slug: 1 });

// Categorical indexes for frequent UI filtering
programSchema.index({ category: 1 });
programSchema.index({ format: 1 });

// ==============================
// VIRTUAL PROPERTIES
// ==============================
// Fields dynamically computed upon retrieval, not physically stored in the database

// Convert duration from strictly recorded weeks into a months format (assuming ~4 weeks/month)
programSchema.virtual('durationMonths').get(function () {
  return Math.round((this.duration / 4) * 10) / 10;
});

// Virtual populate to connect associated reviews without storing an unbounded array of IDs
programSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'program',
  localField: '_id',
});

// ==============================
// DOCUMENT MIDDLEWARE (PRE-SAVE)
// ==============================
// Executes locally before a document is permanently saved into the database collection

programSchema.pre('save', function () {
  if (this.isModified('name') || this.isNew) {
    // Generate a URL-friendly slug from the program name (e.g., "Strength Protocol" -> "strength-protocol")
    this.slug = slugify(this.name, { lower: true });
  }
});

// ==============================
// QUERY MIDDLEWARE
// ==============================
// Automatically injects operational constraints before standard 'find' executions

// Automatically populate the assigned trainer objects by referencing the stored ObjectIds
programSchema.pre(/^find/, function () {
  this.populate({
    path: 'trainers',
    select: '-__v -passwordChangedAt', // Exclude internal versioning and sensitive metrics
  });
});

// ==============================
// MODEL CREATION
// ==============================

const Program = mongoose.model('Program', programSchema);

// ==============================
// EXPORT
// ==============================

module.exports = Program;
