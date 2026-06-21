// ==============================
// IMPORTS
// ==============================

const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const programRouter = require('./routes/programRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));

/*
|--------------------------------------------------------------------------
| APPLICATION CORE SETUP
|--------------------------------------------------------------------------
| Initializes the Express framework application instance.
*/

// ==============================
// EXPRESS APP SETUP
// ==============================

const app = express();

/* 
When your Express app runs behind a proxy/load balancer (Render, Heroku, Nginx, Cloudflare, etc.), 
the connection between the proxy and your Node app is often HTTP, 
even though the user's browser connected via HTTPS. 

app.enable('trust proxy');
doing this is important when doing secure: req.secure in cookieOptions
*/

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
);

// Handle pre-flight OPTIONS queries across all routes
app.options('*', cors());

/*
|--------------------------------------------------------------------------
| GLOBAL MIDDLEWARES
|--------------------------------------------------------------------------
| Configures core application security layers, body parsers, logging configurations,
| and data sanitization processing pipelines.
*/

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// SECURITY HEADERS MIDDLEWARE
// ==============================
// Set security HTTP headers via helmet to protect against well-known vulnerabilities
app.use(helmet());

// ==============================
// RATE LIMITING MIDDLEWARE
// ==============================
// Create a rate limiter middleware to prevent brute-force and Denial of Service (DoS) attacks
const limiter = rateLimit({
  // Maximum number of requests allowed from a single IP within the time window below
  max: 100,

  // Time window for the request limit (1 hour)
  windowMs: 60 * 60 * 1000,

  // Message returned when the client exceeds the limit
  message: 'Too many requests from this IP, please try again in an hour!',
});

// Apply the rate limiter middleware to all routes starting with "/api"
app.use('/api', limiter);

app.use(compression());

// ==============================
// LOGGING MIDDLEWARE
// ==============================
// Morgan logs HTTP requests in development environment for debugging and monitoring
if (process.env.NODE_ENV === 'development') {
  // Use 'dev' format for concise, colored request logs
  app.use(morgan('dev'));
}

// ==============================
// STRIPE WEBHOOK CHECKOUT ROUTE
// ==============================
// This route must be mounted before express.json() is applied because Stripe requires
// the raw, unparsed request body to verify the signature of webhook payloads.
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }),
  bookingController.webhookCheckout,
);

// ==============================
// JSON PARSING & BODY LIMIT MIDDLEWARE
// ==============================
// Parses incoming JSON request bodies and populates req.body
// limit option helps protect the server from very large payload attacks, prevents DoS
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ==============================
// DATA SANITIZATION MIDDLEWARE
// ==============================

// Data sanitization against NoSQL query injection (removes $ and . modifiers)
app.use(mongoSanitize());

// Data sanitization against Cross-Site Scripting (XSS) attacks (strips malicious HTML code)
app.use(xss());

// ==============================
// PARAMETER POLLUTION MIDDLEWARE
// ==============================
// Preventing parameter pollution by removing duplicate query parameters except those whitelisted
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// ==============================
// ROUTE MOUNTING
// ==============================
// Mount routers for specific API resources at their base paths

// API Documentation: /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Programs API: /api/v1/programs
app.use('/api/v1/programs', programRouter);

// Users API: /api/v1/users
app.use('/api/v1/users', userRouter);

// Reviews API: /api/v1/reviews
app.use('/api/v1/reviews', reviewRouter);

// Reviews API: /api/v1/bookings
app.use('/api/v1/bookings', bookingRouter);

// ==============================
// UNHANDLED ROUTES MIDDLEWARE
// ==============================
// Catches requests to routes that don't exist
// Must be placed AFTER all other route handlers

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLING MIDDLEWARE
|--------------------------------------------------------------------------
| Captures all thrown exceptions and rejected operational parameters passed via next(err)
| Express identifies it as an error handler by the 4 parameters: (err, req, res, next)
*/

app.use(globalErrorHandler);

// ==============================
// EXPORT APPLICATION
// ==============================

module.exports = app;
