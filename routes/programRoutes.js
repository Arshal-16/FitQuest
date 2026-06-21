// ==============================
// IMPORTS
// ==============================

const express = require('express');
const programController = require('./../controllers/programController');
const authController = require('./../controllers/authController');
const reviewRouter = require('./../routes/reviewRoutes');

/*
|--------------------------------------------------------------------------
| PROGRAM ROUTES
|--------------------------------------------------------------------------
| Configures endpoint pathways for program management operations including
| public browsing, protected bookings, and admin/trainer CRUD operations.
*/

// ==============================
// ROUTER SETUP
// ==============================

const router = express.Router();

// ==============================
// NESTED ROUTE — REVIEWS
// ==============================
// Forwards any requests matching /:programId/reviews to the review router
// POST /api/v1/programs/:programId/reviews
// GET  /api/v1/programs/:programId/reviews

router.use('/:programId/reviews', reviewRouter);

// ==============================
// ALIAS ROUTE — TOP 5 PROGRAMS
// ==============================
// Pre-fills query params before hitting getAllPrograms
// GET /api/v1/programs/top-5-cheap

router
  .route('/top-5-cheap')
  .get(programController.aliasTopPrograms, programController.getAllPrograms);

// ==============================
// STATS ROUTE
// ==============================
// Returns aggregated stats grouped by difficulty and category
// GET /api/v1/programs/program-stats

router.route('/program-stats').get(programController.getProgramStats);

// ==============================
// MY PROGRAMS ROUTE
// ==============================
// Get all programs created by the authenticated trainer
// GET /api/v1/programs/my-programs

router.get(
  '/my-programs',
  authController.protect,
  authController.restrictTo('trainer'),
  programController.getMyPrograms,
);

// ==============================
// MONTHLY PLAN ROUTE
// ==============================
// Returns number of programs starting each month for a given year
// Only accessible to admin and trainer roles
// GET /api/v1/programs/monthly-plan/:year

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'trainer'),
    programController.getMonthlyPlan,
  );

// ==============================
// ROOT ROUTE — /api/v1/programs
// ==============================
// GET  — public, supports filtering/sorting/pagination
// POST — restricted to admin and trainer only

router
  .route('/')
  // Get all programs with optional filtering, sorting, and pagination
  .get(programController.getAllPrograms)
  // Create a new program
  // Restricted: Only admin and trainer can create programs
  .post(
    authController.protect,
    authController.restrictTo('admin', 'trainer'),
    programController.uploadProgramImages,
    programController.processProgramImages,
    programController.createProgram,
  );

// ==============================
// INDIVIDUAL ROUTE — /api/v1/programs/:id
// ==============================
// GET    — public
// PATCH  — restricted to admin and trainer, includes image upload middleware
// DELETE — restricted to admin and trainer

router
  .route('/:id')
  // Get a single program by ID
  .get(programController.getProgram)
  // Update a program by ID with image upload processing
  // Restricted: Only admin and trainer can update programs
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'trainer'),
    programController.uploadProgramImages,
    programController.processProgramImages,
    programController.updateProgram,
  )
  // Permanently delete a program by ID
  // Restricted: Only admin and trainer can delete programs
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'trainer'),
    programController.deleteProgram,
  );

// ==============================
// EXPORT ROUTER
// ==============================

module.exports = router;
