// ==============================
// IMPORTS
// ==============================

const multer = require('multer');
const { streamUpload, destroyImage } = require('./../utils/cloudinary');
const User = require('./../models/userModel');
const Booking = require('./../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

/*
|--------------------------------------------------------------------------
| USER CONTROLLERS
|--------------------------------------------------------------------------
| These controllers handle user-related operations.
| Standard CRUD utilities are delegated to the generic factory module, 
| while specific endpoints address account lifecycle tasks for logged-in users.
*/

// ==============================
// FILE UPLOAD CONFIGURATION
// ==============================

/*
// Disk storage alternative (Commented out in favor of memory storage for image processing)
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img/users');
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  }
});
*/

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
exports.uploadUserPhoto = upload.single('photo');

// ==============================
// IMAGE UPLOAD MIDDLEWARE
// ==============================
// Uploads the profile image to Cloudinary

exports.processUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const currentUser = await User.findById(req.user.id).select('+photoPublicId');

  const result = await streamUpload(req.file.buffer, {
    folder: 'fitquest/users',
    public_id: `user-${req.user.id}-${Date.now()}`,
  });

  req.file.filename = result.secure_url;
  req.file.publicId = result.public_id;

  if (currentUser?.photoPublicId) {
    await destroyImage(currentUser.photoPublicId);
  }

  next();
});

// ==============================
// UTILITY FUNCTIONS
// ==============================

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};

  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });

  return newObj;
};

// ==============================
// GET ME (MIDDLEWARE)
// ==============================
// Middleware to inject current user's ID into req.params before passing down

exports.getMe = (req, res, next) => {
  // Overwrite the parameter ID using the payload extracted via authentication middleware
  req.params.id = req.user.id;

  // Forward flow to downstream handler factory method
  next();
};

// ==============================
// UPDATE ME
// ==============================
// Updates non-sensitive account parameters for the currently logged-in user

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400,
      ),
    );
  }

  // 2) Filter out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');

  // If an image was processed and attached to the request, link the filename and public ID to the update payload
  if (req.file) {
    filteredBody.photo = req.file.filename;
    filteredBody.photoPublicId = req.file.publicId;
  }

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true, // Return modified document rather than original snapshot
    runValidators: true, // Trigger schema-level assertions during execution
  });

  // Send success response with updated user details
  res.status(200).json({
    status: 'success',
    data: {
      data: updatedUser,
    },
  });
});

// ==============================
// DELETE ME
// ==============================
// Flags the user profile as inactive rather than deleting hard entry from database

exports.deleteMe = catchAsync(async (req, res, next) => {
  // Perform lookup and toggle visibility state safely via query method
  await User.findByIdAndUpdate(req.user.id, { active: false });

  // Send empty payload indicating success
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ==============================
// CREATE USER - PLACEHOLDER
// ==============================
// Note: Use the signup route instead to register new users

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead',
  });
};

// ==============================
// GET ALL TRAINERS
// ==============================
// Specialized route to fetch only users explicitly registered with the 'trainer' role

exports.getAllTrainers = catchAsync(async (req, res, next) => {
  // Query the database strictly for users possessing the trainer role constraint
  const trainers = await User.find({ role: 'trainer' });

  // Return the filtered list of trainers back to the client payload
  res.status(200).json({
    status: 'success',
    results: trainers.length,
    data: {
      data: trainers,
    },
  });
});

// ==============================
// GET ALL USER BOOKINGS
// ==============================
// Retrieves all purchase/booking records associated with the currently logged-in user

// Wrapped in catchAsync to maintain global error handling coverage
exports.getMyBookings = catchAsync(async (req, res, next) => {
  // Find all booking documents where the user reference matches the logged-in user's ID
  const bookings = await Booking.find({ user: req.user.id });

  // Return the fetched array of user-specific bookings
  res.status(200).json({
    status: 'success',
    data: {
      data: bookings,
    },
  });
});

// ==============================
// FACTORY OPERATIONS
// ==============================
// Standard administrative actions delegated to the reusable factory architecture

exports.getUser = factory.getOne(User);

exports.getAllUsers = factory.getAll(User);

exports.updateUser = factory.updateOne(User);

// Delete a user by ID (with Cloudinary image cleanup)
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+photoPublicId');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Delete profile image from Cloudinary
  if (user.photoPublicId) {
    await destroyImage(user.photoPublicId);
  }

  // Delete user document from MongoDB
  await User.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
