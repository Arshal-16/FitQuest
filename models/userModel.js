// ==============================
// IMPORTS
// ==============================

const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

/*
|--------------------------------------------------------------------------
| USER SCHEMA & MODEL DEFINITION
|--------------------------------------------------------------------------
| Defines the structural blueprint, validation rules, security hooks,
| and custom instance methods for user documents.
*/

// ==============================
// USER SCHEMA
// ==============================

const userSchema = new mongoose.Schema(
  {
    // ==============================
    // BASIC USER INFORMATION
    // ==============================

    name: {
      type: String,
      required: [true, 'Please tell us your name!'],
      trim: true,
      minlength: [3, 'Name must have at least 3 characters'],
      maxlength: [40, 'Name must have less than 40 characters'],
    },

    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      // Convert email to lowercase for consistency
      lowercase: true,
      // Validates that the email is in a valid format
      validate: [validator.isEmail, 'Please provide a valid email'],
    },

    photo: {
      type: String,
      default: 'default.jpg',
    },

    photoPublicId: {
      type: String,
      select: false, // internal bookkeeping, don't expose in API responses
    },

    role: {
      type: String,
      enum: ['user', 'trainer', 'admin'],
      default: 'user',
    },

    description: {
      // admin will fill this for trainer
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    specialization: {
      // admin will fill this for trainer
      type: String,
      enum: {
        values: [
          'strength',
          'weight-loss',
          'cardio',
          'flexibility',
          'athletic',
          'rehabilitation',
        ],
        message: 'Specialization must match a valid program category',
      },
    },

    experience: {
      // admin will fill this for trainer
      type: Number,
      min: [0, 'Experience cannot be negative'],
      max: [50, 'Experience cannot exceed 50 years'],
    },

    // ==============================
    // AUTHENTICATION
    // ==============================

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Password is excluded from queries by default for security
      select: false,
    },

    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      // Validator to ensure password and passwordConfirm match
      // Note: Only works on .save() and .create(), not on updates
      validate: {
        validator: function (el) {
          // `this` refers to the current document
          return el === this.password;
        },
        message: 'Passwords are not the same!',
      },
    },

    // Timestamp when password was last changed (used for JWT validation)
    passwordChangedAt: Date,

    // ==============================
    // PASSWORD RESET FIELDS
    // ==============================

    // Hash of the password reset token sent via email
    passwordResetToken: String,

    // Expiration time for password reset token
    passwordResetExpires: Date,

    // ==============================
    // ACCOUNT STATUS
    // ==============================

    active: {
      type: Boolean,
      default: true,
      // Excluded from query outputs by default
      // select: false,
    },
  },

  // ==============================
  // SCHEMA OPTIONS
  // ==============================
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ==============================
// DOCUMENT MIDDLEWARE (PRE-SAVE)
// ==============================

// HASH PASSWORD BEFORE SAVING
userSchema.pre('save', async function () {
  // Only process password if it was modified (not on every document save)
  if (!this.isModified('password')) {
    return;
  }

  // Hash password using bcrypt with salt rounds = 12 (Higher = more secure but slower)
  this.password = await bcrypt.hash(this.password, 12);

  // Remove passwordConfirm field from document before saving (no longer needed after validation)
  this.passwordConfirm = undefined;
});

// UPDATE PASSWORD CHANGED TIMESTAMP
userSchema.pre('save', function () {
  // Skip if password wasn't modified or document is newly created
  if (!this.isModified('password') || this.isNew) {
    return;
  }

  // Subtract 1 second to compensate for DB save latency, ensuring JWTs
  this.passwordChangedAt = Date.now() - 1000;
});

// ==============================
// QUERY MIDDLEWARE
// ==============================

// EXCLUDE INACTIVE USERS
// Runs before any query operation starting with 'find'
userSchema.pre(/^find/, function () {
  // `this` points to the current query object
  // Excludes documents where active is explicitly set to false
  this.find({ active: { $ne: false } });
});

// ==============================
// INSTANCE METHODS
// ==============================

// Compares user-entered password with the hashed database password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Checks if the password was changed after the JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // If passwordChangedAt field exists
  if (this.passwordChangedAt) {
    // Convert milliseconds to seconds for accurate JWT comparison
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000,
    );

    return JWTTimestamp < changedTimestamp;
  }

  // If passwordChangedAt doesn't exist, the password was never changed
  return false;
};

// Generates a reset token, hashes it, stores hash in DB, returns unhashed token
userSchema.methods.createPasswordResetToken = function () {
  // Generate a random reset token (32 bytes = 64 hex characters)
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token using SHA-256 before storing in database for security
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiry to 10 minutes from now
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return the unhashed token
  return resetToken;
};

// ==============================
// MODEL CREATION
// ==============================

const User = mongoose.model('User', userSchema);

// ==============================
// EXPORT
// ==============================

module.exports = User;
