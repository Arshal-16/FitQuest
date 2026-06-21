// ==============================
// IMPORTS
// ==============================

const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

/*
|--------------------------------------------------------------------------
| USER ROUTES ROUTER DEFINITION
|--------------------------------------------------------------------------
| Configures endpoint pathways for user management operations including
| public authentication workflows, protected personal account actions, 
| and strictly restricted administrative CRUD operations.
*/

// ==============================
// ROUTER SETUP
// ==============================

const router = express.Router();

// ==============================
// PUBLIC AUTHENTICATION ROUTES
// ==============================
// These routes are open to unauthenticated users

// Get all users assigned to the trainer role
// GET /api/v1/users/trainers
router.get('/trainers', userController.getAllTrainers);

// Sign up a new user account
// POST /api/v1/users/signup
router.post(
  '/signup',
  authController.uploadSignupPhoto,
  authController.processSignupPhoto,
  authController.signup,
);

// Authenticate user and provide JWT
// POST /api/v1/users/login
router.post('/login', authController.login);

// Log user out by clearing the JWT cookie
// GET /api/v1/users/logout
router.get('/logout', authController.logout);

// Generate password reset token and send via email
// POST /api/v1/users/forgotPassword
router.post('/forgotPassword', authController.forgotPassword);

// Reset user password using the emailed token
// PATCH /api/v1/users/resetPassword/:token
router.patch('/resetPassword/:token', authController.resetPassword);

// ==============================
// PROTECTED ROUTES MIDDLEWARE
// ==============================
// Enforces authentication for ALL routes defined after this point.
// Requests without a valid JWT will be rejected here.

router.use(authController.protect);

// ==============================
// CURRENT AUTHENTICATED USER ROUTES
// ==============================
// Actions the currently logged-in user can perform on their own profile

// Update password of the logged in user
// PATCH /api/v1/users/updateMyPassword
router.patch('/updateMyPassword', authController.updatePassword);

// Retrieve data for the currently logged-in user
// GET /api/v1/users/me
router.get('/me', userController.getMe, userController.getUser);

// Retrieve all bookings associated with the currently logged-in user
// GET /api/v1/users/my-bookings
router.get('/my-bookings', userController.getMyBookings);

// Update current user's profile data (name, email, photo)
// PATCH /api/v1/users/updateMe
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.processUserPhoto,
  userController.updateMe,
);

// Deactivate current user account (soft delete)
// DELETE /api/v1/users/deleteMe
router.delete('/deleteMe', userController.deleteMe);

// ==============================
// ADMIN RESTRICTED ROUTES MIDDLEWARE
// ==============================
// Enforces role-based access control.
// Only users with the 'admin' role can access the routes below this point.

router.use(authController.restrictTo('admin'));

// ==============================
// ROOT ROUTE: /api/v1/users
// ==============================
// Handles collection-level administrative user operations

router
  .route('/')
  // Get all users in the database
  .get(userController.getAllUsers)
  // Create a new user (usually a placeholder, as signup is preferred)
  .post(userController.createUser);

// ==============================
// INDIVIDUAL ROUTE: /api/v1/users/:id
// ==============================
// Handles operations on specific users by their ID

router
  .route('/:id')
  // Get a single user by ID
  .get(userController.getUser)
  // Update a user's data by ID
  .patch(userController.updateUser)
  // Permanently delete a user by ID
  .delete(userController.deleteUser);

// ==============================
// EXPORT ROUTER
// ==============================

module.exports = router;
