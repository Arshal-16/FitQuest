// ==============================
// IMPORTS
// ==============================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const multer = require('multer');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const { streamUpload } = require('./../utils/cloudinary');

/*
|--------------------------------------------------------------------------
| AUTH CONTROLLERS
|--------------------------------------------------------------------------
| Handles authentication operations: signup, login, password reset, etc.
*/

// ==============================
// FILE UPLOAD CONFIGURATION
// ==============================

// Store the file as a buffer in memory so it can be uploaded to Cloudinary
const multerStorage = multer.memoryStorage();

// Verify that the uploaded file is strictly an image
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// Initialize multer with the defined storage and filter configurations
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});

// Expose a middleware to handle a single file upload from the 'photo' form field
exports.uploadSignupPhoto = upload.single('photo');

// ==============================
// IMAGE UPLOAD MIDDLEWARE FOR SIGNUP
// ==============================
// Uploads the profile image to Cloudinary
// Used during signup before user account is created

exports.processSignupPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const result = await streamUpload(req.file.buffer, {
    folder: 'fitquest/users',
    public_id: `user-signup-${Date.now()}`,
  });

  req.file.filename = result.secure_url;
  req.file.publicId = result.public_id;
  next();
});

// ==============================
// HELPER: SIGN JWT TOKEN
// ==============================
// Creates and signs a JWT token with the user ID
// Token is used for authentication on protected routes

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// ==============================
// HELPER: CREATE AND SEND JWT TOKEN
// ==============================
// Creates and signs a JWT token with the user ID ands sends it back

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Options/settings for the cookie
  const cookieOptions = {
    // Set cookie expiration date
    // Converts days into milliseconds
    expires: new Date(
      Date.now() +
      Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000,
    ),

    // Cookie will only be sent over HTTPS
    // Helps improve security
    secure: true,

    // Prevents JavaScript in the browser from accessing the cookie
    // Protects against XSS attacks (token theft)
    httpOnly: true,
  };

  // Send the JWT token as a cookie named "jwt"
  res.cookie('jwt', token, cookieOptions);

  // remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

// ==============================
// CONTROLLER: SIGNUP
// ==============================
// Registers a new user in the system
// Only accepts specific fields to prevent unauthorized role/field assignment

exports.signup = catchAsync(async (req, res, next) => {
  // Manually selecting allowed fields prevents users from setting
  // sensitive fields like role or admin status directly

  const userData = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  };

  // If an image was processed and attached to the request, link the filename and public ID to the user data
  if (req.file) {
    userData.photo = req.file.filename;
    userData.photoPublicId = req.file.publicId;
  }

  const newUser = await User.create(userData);

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

// ==============================
// CONTROLLER: LOGIN
// ==============================
// Authenticates user with email and password
// Returns JWT token for use in subsequent requests

exports.login = catchAsync(async (req, res, next) => {
  // Destructure email and password from request body
  const { email, password } = req.body;

  // ==============================
  // VALIDATE INPUT
  // ==============================
  // Both email and password are required

  if (!email || !password) {
    return next(new AppError('Please enter email and password!', 400));
  }

  // ==============================
  // FIND USER BY EMAIL
  // ==============================
  // Password field is excluded by default (select: false in schema)
  // Explicitly include it for authentication comparison

  const user = await User.findOne({ email }).select('+password');

  // ==============================
  // VALIDATE CREDENTIALS
  // ==============================
  // Check if user exists AND password is correct
  // Use user.correctPassword() method which compares with bcrypt hash

  if (!user || !(await user.correctPassword(password, user.password))) {
    // 401 = Unauthorized
    return next(new AppError('Please enter correct email and password!', 401));
  }

  // ==============================
  // GENERATE TOKEN & RESPOND
  // ==============================

  createSendToken(user, 200, res);
});

// ==============================
// MIDDLEWARE: PROTECT
// ==============================
// Protects routes so only authenticated (logged-in) users can access them
// Extracts and validates JWT token, retrieves user from DB

exports.protect = catchAsync(async (req, res, next) => {
  // ==============================
  // STEP 1: GET TOKEN FROM HEADERS
  // ==============================

  let token;

  // Authorization header format: "Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Extract token from header
    // 'Bearer token123' → ['Bearer', 'token123'] → 'token123'
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // If no token found, user is not authenticated
  if (!token) {
    return next(
      new AppError('You are not logged in, please log in to get access!', 401),
    );
  }

  // ==============================
  // STEP 2: VERIFY TOKEN
  // ==============================
  // jwt.verify() validates:
  // - Token signature (correct secret key)
  // - Token expiration (not expired)
  // - Token format (valid structure)
  //
  // promisify() converts callback-based jwt.verify() into promise-based
  // This allows use of async/await

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // Decoded contains JWT payload:
  // - id: user ID
  // - iat: issued at timestamp
  // - exp: expiration timestamp

  // ==============================
  // STEP 3: CHECK USER STILL EXISTS
  // ==============================

  const user = await User.findById(decoded.id);

  if (!user) {
    return next(
      new AppError(
        'The user to which this token belongs does no longer exists',
        401,
      ),
    );
  }

  // ==============================
  // STEP 4: CHECK PASSWORD NOT CHANGED
  // ==============================
  // If user changed password after token was issued,
  // invalidate the token for security

  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User recently changed the password. Please login again!',
        401,
      ),
    );
  }

  // ==============================
  // STEP 5: GRANT ACCESS & ATTACH USER
  // ==============================
  // Attach user to request for use in next middleware/route handlers

  req.user = user;

  // Grant access to protected route
  next();
});

// ==============================
// MIDDLEWARE: RESTRICT TO ROLES
// ==============================
// Authorization middleware: only allows users with specific roles
// Usage: restrictTo('admin', 'trainer')

exports.restrictTo =
  (...roles) =>
    (req, res, next) => {
      // Check if current user's role is in the allowed roles list

      if (!roles.includes(req.user.role)) {
        return next(
          new AppError(
            'You do not have permission to perform this action!',
            403, // 403 = Forbidden
          ),
        );
      }

      // User has required role, proceed to next middleware/route handler
      next();
    };

// ==============================
// CONTROLLER: FORGOT PASSWORD
// ==============================
// Initiates password reset process
//
// Flow:
// 1. Find user by email
// 2. Generate reset token
// 3. Save hashed token to DB with expiry
// 4. Send token via email to user
// 5. If email fails, clean up token from DB

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // ==============================
  // STEP 1: FIND USER BY EMAIL
  // ==============================

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('No user exists with that email!', 404));
  }

  // ==============================
  // STEP 2: GENERATE RESET TOKEN
  // ==============================
  // This method (defined in userModel):
  // 1. Creates random token
  // 2. Hashes it with SHA-256
  // 3. Saves hashed version to user.passwordResetToken
  // 4. Sets user.passwordResetExpires to 10 min from now
  // 5. Returns UNHASHED token to be emailed to user
  //
  // Why hash the token?
  // If the database is compromised, tokens alone cannot be used.
  // Attacker still needs to hash their token to compare.

  const resetToken = user.createPasswordResetToken();

  // ==============================
  // STEP 3: SAVE TOKEN TO DATABASE
  // ==============================
  // Must save document because we modified:
  // - passwordResetToken field
  // - passwordResetExpires field
  //
  // validateBeforeSave: false is necessary because:
  // - Password field will be empty (required in schema)
  // - PasswordConfirm field will be empty (required in schema)
  // - Normal validation would fail
  // We only need to save reset token fields, not validate password fields

  await user.save({ validateBeforeSave: false });

  // ==============================
  // STEP 4: SEND TOKEN VIA EMAIL
  // ==============================

  try {
    // Build password reset URL
    // User will click this link in the email
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    // Email sent successfully
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    // ==============================
    // STEP 5: CLEANUP IF EMAIL FAILS
    // ==============================
    // If email sending fails, remove reset token from database
    // Otherwise: unusable token remains in DB, user confused

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Save without validation (same reason as above)
    await user.save({ validateBeforeSave: false });

    // Forward error to global error handler
    return next(
      new AppError(
        'There was an error sending the email! Please try again later!',
        500,
      ),
    );
  }
});

// ==============================
// CONTROLLER: RESET PASSWORD
// ==============================
// Completes password reset using token sent via email
//
// Flow:
// 1. Hash the token from URL (must match DB hash)
// 2. Find user with matching token (and token not expired)
// 3. Set new password and clear reset token fields
// 4. Generate new JWT and log user in automatically

exports.resetPassword = catchAsync(async (req, res, next) => {
  // ==============================
  // STEP 1: HASH TOKEN FROM URL
  // ==============================
  // Token in email is unhashed
  // Must hash it to compare against DB (which stores hashed version)

  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // ==============================
  // STEP 2: FIND USER WITH VALID TOKEN
  // ==============================
  // Query for user with:
  // - Matching passwordResetToken
  // - Token that hasn't expired ($gt = greater than current time)

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // ==============================
  // STEP 3: VALIDATE TOKEN EXISTS
  // ==============================

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // ==============================
  // STEP 4: UPDATE PASSWORD
  // ==============================
  // Set new password (will be hashed by pre-save middleware)
  // Set passwordConfirm for validation

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // ==============================
  // STEP 5: CLEAR RESET TOKEN FIELDS
  // ==============================
  // Token has been used, no longer needed

  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;

  // ==============================
  // STEP 6: SAVE USER
  // ==============================
  // .save() triggers:
  // - Password validation (min length, match confirm)
  // - Password hashing (bcrypt)
  // - Password change timestamp update

  await user.save();

  // ==============================
  // STEP 7: LOG USER IN WITH NEW JWT
  // ==============================
  // Generate JWT and send to client
  // User is now authenticated with new password

  createSendToken(user, 200, res);
});

// ==============================
// CONTROLLER: UPDATE PASSWORD
// ==============================
// Allows logged-in users to update their current password
//
// Flow:
// 1. Retrieve user with password field explicitly selected
// 2. Verify current password matches the database records
// 3. Update to the new password and save (triggers hashing middleware)
// 4. Issue a fresh JWT token to seamlessly keep the user logged in

exports.updatePassword = catchAsync(async (req, res, next) => {
  // ==============================
  // STEP 1: GET THE USER FROM COLLECTION
  // ==============================
  // Password field is excluded by default (select: false in schema)
  // Explicitly include it for current password comparison

  const user = await User.findById(req.user.id).select('+password');

  // ==============================
  // STEP 2: CHECK IF CURRENT PASSWORD IS CORRECT
  // ==============================
  // Use user.correctPassword() method which compares with bcrypt hash

  const isCorrect = await user.correctPassword(
    req.body.passwordCurrent,
    user.password,
  );

  if (!isCorrect) {
    // 401 = Unauthorized
    return next(new AppError('Incorrect current password!', 401));
  }

  // ==============================
  // STEP 3: UPDATE & SAVE PASSWORD
  // ==============================
  // Set new password (will be hashed by pre-save middleware)
  // Set passwordConfirm for validation

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // .save() triggers validation and hashing
  await user.save();

  // ==============================
  // STEP 4: LOG USER IN BY SENDING JWT
  // ==============================
  // Generate a fresh JWT and send it back to the client

  createSendToken(user, 200, res);
});

// ==============================
// CONTROLLER: LOGOUT
// ==============================
// Replaces the auth cookie with a short-lived placeholder value
// Browser keeps the cookie name, but the stored JWT becomes unusable

exports.logout = (req, res, next) => {
  res.cookie('jwt', 'loggedOut', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  // Let the client know the logout operation completed successfully
  res.status(200).json({ status: 'success' });
};
