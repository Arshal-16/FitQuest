// ==============================
// IMPORTS
// ==============================

const Review = require('./../models/reviewModel');
const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

/*
|--------------------------------------------------------------------------
| REVIEW CONTROLLERS
|--------------------------------------------------------------------------
| Handles all review-related operations using shared factory utilities.
| Offers functionalities for filtering, standard CRUD, and nested data management.
*/

// ==============================
// NESTED ROUTE MIDDLEWARE
// ==============================

/*
 Automatically attaches program and user IDs to the request body from context parameters.
 Essential for facilitating seamless nested routes 
 (e.g., /programs/:programId/reviews).
 */
exports.setProgramUserIds = (req, res, next) => {
  // If no program ID is explicitly specified in the body, pull it from the route parameters
  if (!req.body.program) {
    req.body.program = req.params.programId;
  }

  // If no user ID is explicitly specified in the body, pull it from the authenticated user context
  if (!req.body.user) {
    req.body.user = req.user.id;
  }

  // Hand over execution control to the next middleware or factory handler in line
  next();
};

// ==============================
// CRUD HANDLERS
// ==============================

// Retrieves all reviews from the database using the shared factory method
exports.getAllReviews = factory.getAll(Review);

// Retrieves a single review document matching the provided ID via the factory utility
exports.getReview = factory.getOne(Review);

// Creates a new review document matching the factory structural blueprint
exports.createReview = factory.createOne(Review);

// Updates an existing review document matching the provided ID via factory mutations
exports.updateReview = factory.updateOne(Review);

// Permanently removes a review document from the database using the factory controller
exports.deleteReview = factory.deleteOne(Review);

// Middleware to verify ownership of a review before modification or deletion
exports.checkReviewOwnership = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  // If editing (PATCH), strictly allow only the author
  if (req.method === 'PATCH') {
    if (review.user._id.toString() !== req.user.id) {
      return next(
        new AppError('You can only edit reviews that you created.', 403),
      );
    }
  }

  // If deleting (DELETE), allow either the author or an admin
  if (req.method === 'DELETE') {
    const isAuthor = review.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return next(
        new AppError('You are not authorized to delete this review.', 403),
      );
    }
  }

  next();
});
