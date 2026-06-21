const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Program = require('../models/programModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

/*
|--------------------------------------------------------------------------
| BOOKING CONTROLLERS
|--------------------------------------------------------------------------
| Handles Stripe checkout creation, payment webhook confirmation,
| and standard administrative booking CRUD operations.
*/

// ==============================
// CONTROLLER: GET CHECKOUT SESSION
// ==============================
// Creates a Stripe Checkout Session for the selected program
// Requires an authenticated user so the checkout can be tied back to their account

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // Get the currently booked program
  const program = await Program.findById(req.params.programId);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${req.protocol}://${req.get('host')}/my-bookings`,
    cancel_url: `${req.protocol}://${req.get('host')}/programs/${req.params.programId}`,
    customer_email: req.user.email,
    client_reference_id: req.params.programId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: program.price * 100, // Amount in cents
          product_data: {
            name: `${program.name} Program`,
            description: program.summary,
          },
        },
        quantity: 1,
      },
    ],
  });

  // Send session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

// ==============================
// HELPER: CREATE BOOKING AFTER CHECKOUT
// ==============================
// Converts a successful Stripe checkout session into a local Booking document
// Called only after Stripe confirms payment through the webhook endpoint

const createBookingCheckout = async (session) => {
  // Stripe stores the purchased program ID as the checkout session reference
  const program = session.client_reference_id;

  // 1. find the user
  const userObj = await User.findOne({ email: session.customer_email });
  if (!userObj) return; // Add a safety guard clause
  const user = userObj.id;

  // 2. FIXED: Use session.amount_total instead of session.display_items
  const price = session.amount_total / 100;

  // Persist the completed purchase in the application database
  await Booking.create({ program, user, price });
};

// ==============================
// CONTROLLER: STRIPE WEBHOOK
// ==============================
// Verifies Stripe's signature before trusting the event payload
// Creates a booking only when checkout.session.completed is received

exports.webhookCheckout = catchAsync(async (req, res, next) => {
  // Stripe sends this signature header so we can confirm the request is authentic
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    // It's a good practice to handle promises in webhooks safely
    await createBookingCheckout(event.data.object);
  }

  res.status(200).json({ received: true });
});

// ==============================
// FACTORY CRUD OPERATIONS
// ==============================
// Standard booking management endpoints delegated to the reusable factory handlers

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
