// ==============================
// IMPORTS
// ==============================

const multer = require('multer');
const { streamUpload, destroyImage } = require('./../utils/cloudinary');
const Program = require('./../models/programModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

/*
|--------------------------------------------------------------------------
| PROGRAM CONTROLLER
|--------------------------------------------------------------------------
| Handles all program-related operations including image processing,
| alias routes, aggregation stats, and standard CRUD via factory handlers.
*/

// ==============================
// MULTER CONFIGURATION
// ==============================
// Store uploaded images in memory as Buffer objects
// Cloudinary will stream upload them directly from the buffers

const multerStorage = multer.memoryStorage();

// Filter to allow only image files
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
});

// ==============================
// UPLOAD PROGRAM IMAGES
// ==============================
// Accepts a single cover image and up to 3 gallery images
// Field names must match what the client sends in the form

exports.uploadProgramImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// ==============================
// UPLOAD PROGRAM IMAGES TO CLOUDINARY
// ==============================
// Uploads program cover and gallery images to Cloudinary, and removes old ones if applicable
// Runs after uploadProgramImages middleware

exports.processProgramImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();
  if (!req.files.imageCover && !req.files.images) return next();

  let currentProgram = null;
  if (req.params.id) {
    currentProgram = await Program.findById(req.params.id).select(
      '+imageCoverPublicId +imagesPublicIds',
    );
  }

  // COVER IMAGE
  if (req.files.imageCover) {
    const result = await streamUpload(req.files.imageCover[0].buffer, {
      folder: 'fitquest/programs',
      public_id: `program-${req.params.id || 'new'}-${Date.now()}-cover`,
    });

    req.body.imageCover = result.secure_url;
    req.body.imageCoverPublicId = result.public_id;

    if (currentProgram?.imageCoverPublicId) {
      await destroyImage(currentProgram.imageCoverPublicId);
    }
  }

  // GALLERY IMAGES
  if (req.files.images) {
    req.body.images = [];
    req.body.imagesPublicIds = [];

    await Promise.all(
      req.files.images.map(async (file, i) => {
        const result = await streamUpload(file.buffer, {
          folder: 'fitquest/programs',
          public_id: `program-${req.params.id || 'new'}-${Date.now()}-${i + 1}`,
        });

        req.body.images.push(result.secure_url);
        req.body.imagesPublicIds.push(result.public_id);
      }),
    );

    if (currentProgram?.imagesPublicIds?.length) {
      await Promise.all(currentProgram.imagesPublicIds.map(destroyImage));
    }
  }

  next();
});

// ==============================
// ALIAS: TOP 5 PROGRAMS
// ==============================
// Pre-fills query parameters to return the top 5 highest rated cheapest programs
// Used as a shortcut route for featured programs on the homepage

exports.aliasTopPrograms = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty,category';
  next();
};

// ==============================
// GET PROGRAM STATS
// ==============================
// Aggregation pipeline that returns statistics grouped by difficulty
// Also returns a breakdown by category

exports.getProgramStats = catchAsync(async (req, res, next) => {
  // ==============================
  // DIFFICULTY STATS
  // ==============================

  const stats = await Program.aggregate([
    {
      // Filter programs with a minimum rating threshold
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      // Group by difficulty level and calculate stats for each group
      $group: {
        _id: { $toUpper: '$difficulty' },
        numPrograms: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      // Sort groups by average price ascending
      $sort: { avgPrice: 1 },
    },
  ]);

  // ==============================
  // CATEGORY STATS
  // ==============================

  const categoryStats = await Program.aggregate([
    {
      // Group all programs by category regardless of rating
      $group: {
        _id: '$category',
        numPrograms: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        avgRating: { $avg: '$ratingsAverage' },
      },
    },
    {
      // Sort by number of programs descending — most popular category first
      $sort: { numPrograms: -1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      categoryStats,
    },
  });
});

// ==============================
// GET MONTHLY PLAN
// ==============================
// Returns how many programs start each month of a given year
// Useful for admins to plan trainer availability and scheduling

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = Number(req.params.year);

  const plan = await Program.aggregate([
    {
      // Deconstruct startDates array — creates one document per start date
      $unwind: '$startDates',
    },
    {
      // Filter only dates that fall within the requested year
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      // Group by month and count programs starting that month
      $group: {
        _id: { $month: '$startDates' },
        numProgramStarts: { $sum: 1 },
        programs: { $push: '$name' },
      },
    },
    {
      // Add a readable month field
      $addFields: { month: '$_id' },
    },
    {
      // Hide the _id field from output
      $project: { _id: 0 },
    },
    {
      // Sort by busiest month first
      $sort: { numProgramStarts: -1 },
    },
    {
      // Limit to 12 months maximum
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: plan.length,
    data: {
      plan,
    },
  });
});

// ==============================
// GET MY PROGRAMS
// ==============================
// Returns programs assigned to the currently authenticated trainer
// Used by trainer dashboards to show only the trainer's own programs

exports.getMyPrograms = catchAsync(async (req, res, next) => {
  // Match programs where the trainer reference array contains the logged-in trainer ID
  const programs = await Program.find({ trainers: req.user.id }).select(
    'name slug imageCover difficulty category ratingsAverage ratingsQuantity price startDates maxGroupSize sessionsPerWeek',
  );

  // Return a compact projection with dashboard-friendly program fields
  res.status(200).json({
    status: 'success',
    results: programs.length,
    data: { data: programs },
  });
});

// ==============================
// FACTORY CRUD OPERATIONS
// ==============================
// Standard CRUD operations delegated to the reusable handler factory

// Retrieve all programs — supports filtering, sorting, pagination via APIFeatures
exports.getAllPrograms = factory.getAll(Program);

// Retrieve a single program by ID — populates reviews via virtual populate
exports.getProgram = factory.getOne(Program, { path: 'reviews' });

// Create a new program document
exports.createProgram = factory.createOne(Program);

// Update an existing program by ID
exports.updateProgram = factory.updateOne(Program);

// Delete a program by ID (with Cloudinary image cleanup)
exports.deleteProgram = catchAsync(async (req, res, next) => {
  const program = await Program.findById(req.params.id).select(
    '+imageCoverPublicId +imagesPublicIds',
  );

  if (!program) {
    return next(new AppError('No program found with that ID', 404));
  }

  // Delete cover image from Cloudinary
  if (program.imageCoverPublicId) {
    await destroyImage(program.imageCoverPublicId);
  }

  // Delete secondary gallery images from Cloudinary
  if (program.imagesPublicIds && program.imagesPublicIds.length > 0) {
    await Promise.all(program.imagesPublicIds.map(destroyImage));
  }

  // Delete program document from MongoDB
  await Program.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
