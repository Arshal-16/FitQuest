// ==============================
// IMPORTS
// ==============================

const express = require('express');
const reviewController = require('./../controllers/reviewController');
const authController = require('./../controllers/authController');

/*
|--------------------------------------------------------------------------
| REVIEW ROUTES ROUTER DEFINITION
|--------------------------------------------------------------------------
| Configures endpoint pathways for user review management operations.
| Implements access control so only authenticated users can post reviews 
| and only admins or review authors can modify/delete them.
*/

// ==============================
// ROUTER SETUP
// ==============================

// Initialize the Express router
// mergeParams: true is crucial here! It allows this router to access parameters
// from other routers that mounted it (e.g., getting :programId from the programRouter).
const router = express.Router({ mergeParams: true });

// ==============================
// PROTECTED ROUTES MIDDLEWARE
// ==============================
// Enforces authentication for ALL routes defined after this point.
// Requests without a valid JWT will be rejected here.

router.use(authController.protect);

// ==============================
// ROOT ROUTE: / (or /api/v1/programs/:programId/reviews)
// ==============================
// Handles collection-level review operations

router
  .route('/')
  // Get all reviews (can be all reviews ever, or all reviews for a specific program if nested)
  .get(reviewController.getAllReviews)
  // Create a new review
  // Restricted: Only standard users can post reviews (guides/admins cannot review their own tours)
  .post(
    authController.restrictTo('user'),
    reviewController.setProgramUserIds,
    reviewController.createReview,
  );

// ==============================
// INDIVIDUAL ROUTE: /:id
// ==============================
// Handles operations on specific reviews by their ID

router
  .route('/:id')
  // Get a single review by ID
  .get(reviewController.getReview)
  // Update a review's content by ID
  // Restricted: Only the user who created it can edit it
  .patch(
    authController.restrictTo('user'),
    reviewController.checkReviewOwnership,
    reviewController.updateReview,
  )
  // Permanently delete a review by ID
  // Restricted: The user who created it, or an admin, can delete it
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.checkReviewOwnership,
    reviewController.deleteReview,
  );

// ==============================
// EXPORT ROUTER
// ==============================

module.exports = router;
