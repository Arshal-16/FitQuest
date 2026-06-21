# FitQuest API 🏋️‍♂️

FitQuest is a premium, full-stack fitness program booking platform. This repository contains the backend REST API, built with **Node.js, Express, MongoDB, and Mongoose**, featuring Stripe payments checkout integrations, Cloudinary image hosting, and security optimizations.

---

## 🚀 Key Features

* **User Authentication**: Secure signup, login, password reset flow, and role-based permissions (User, Trainer, Admin) using JSON Web Tokens (JWT) and HttpOnly cookies.
* **Fitness Programs**: Explore, filter, sort, paginate, and search structured training programs.
* **Booking & Checkout**: Integrated with Stripe Checkout Sessions and webhooks to purchase training programs securely.
* **Review System**: Nested reviews for programs preventing users from reviewing the same program multiple times.
* **Image Uploads**: Processed profile and program covers/galleries utilizing Multer and streamed directly to Cloudinary.
* **Security & Performance**: Implemented security headers (Helmet), rate limiting, NoSQL query sanitization, XSS protection, parameter pollution protection (HPP), and data compression.
* **Interactive API Documentation**: Swagger UI integrated natively at `/api-docs` using the OpenAPI 3.0 specification.

---

## 🛠 Tech Stack

* **Runtime & Framework**: Node.js, Express
* **Database & ODM**: MongoDB, Mongoose
* **Payments**: Stripe SDK
* **Media Storage**: Cloudinary SDK
* **Documentation**: Swagger UI Express, OpenAPI 3.0 (YAML)
* **Image Processing**: Multer
* **Email Service**: Nodemailer (Pug templates)

---

## 📂 Project Structure

```text
├── controllers/          # Controllers (request handling & factory crud helpers)
├── models/               # Mongoose Schema Definitions & hooks
├── routes/               # API route endpoints configuration
├── utils/                # Utility modules (APIFeatures, Cloudinary, Email, etc.)
├── views/                # Pug email templates
├── app.js                # Express app setup and middleware configuration
├── server.js             # Node server startup & exception listeners
├── config.env            # Environment configurations (gitignore)
├── openapi.yaml          # OpenAPI 3.0 specification file
└── package.json          # Node dependencies and execution scripts
```

---

## ⚙️ Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/en/) (>= v14)
* [MongoDB](https://www.mongodb.com/) (Local or Atlas database instance)
* [Stripe](https://stripe.com/) Developer account keys
* [Cloudinary](https://cloudinary.com/) Developer account keys

### 1. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 2. Configuration (`config.env`)
Create a `config.env` file in the root directory and configure the environment variables:
```properties
NODE_ENV=development
PORT=3000

# MongoDB
DATABASE=mongodb+srv://<username>:<db_password>@cluster.mongodb.net/fitquest
DATABASE_PASSWORD=your_mongodb_password

# JWT Authentication
JWT_SECRET=your_jwt_signing_secret_key_should_be_long
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

# Stripe Setup
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Server (Mailtrap or standard SMTP)
EMAIL_USERNAME=your_smtp_username
EMAIL_PASSWORD=your_smtp_password
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_FROM=FitQuest Admin <admin@fitquest.com>
```

### 3. Run the Server
For local development with hot reloading (Nodemon):
```bash
npm run dev
```

For production start:
```bash
npm start
```

Once running, you can access the interactive API docs at:
👉 **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

---

## 📍 API Reference Summary

All API endpoints are prefixed with `/api/v1` (except the raw Stripe webhook).

### Authentication & Users
* `POST /users/signup` - Sign up a new user (with profile picture upload)
* `POST /users/login` - Sign in user and receive JWT cookie/token
* `GET /users/logout` - Clear JWT token cookie
* `POST /users/forgotPassword` - Request password reset token email
* `PATCH /users/resetPassword/:token` - Reset password using email token
* `PATCH /users/updateMyPassword` - Update password (Authenticated)
* `GET /users/me` - Get current user profile (Authenticated)
* `PATCH /users/updateMe` - Update profile details name, email, photo (Authenticated)
* `DELETE /users/deleteMe` - Soft-deactivate user account (Authenticated)
* `GET /users/trainers` - Publicly list all trainers

### Programs
* `GET /programs` - List all training programs (supports sorting, pagination, filtering)
* `GET /programs/top-5-cheap` - Pre-filtered query to list top 5 cheap programs
* `GET /programs/program-stats` - Aggregate stats grouped by difficulty and category
* `GET /programs/my-programs` - Get programs assigned to trainer (Trainer only)
* `GET /programs/monthly-plan/:year` - Busiest starting months for a year (Trainer/Admin)
* `GET /programs/:id` - Get program details (populates reviews virtual array)
* `POST /programs` - Create a program (Admin/Trainer, image uploads)
* `PATCH /programs/:id` - Update a program (Admin/Trainer)
* `DELETE /programs/:id` - Delete a program & cleanup Cloudinary assets (Admin/Trainer)

### Reviews
* `GET /reviews` - List all reviews
* `POST /reviews` - Create a program review (User role only)
* `PATCH /reviews/:id` - Edit review content (Review author only)
* `DELETE /reviews/:id` - Delete review (Author or Admin)
* `GET /programs/:programId/reviews` - Nested helper to get reviews for specific program

### Bookings
* `GET /bookings/checkout-session/:programId` - Get Stripe Checkout Session token (Authenticated)
* `POST /webhook-checkout` - Stripe transaction confirmation webhook (Root path)

---

## ☁️ Deploying on Render

1. Create a web service on Render connected to your GitHub repository.
2. In the **Environment Settings**, load all variables defined in your `config.env`.
3. Set the **Build Command** to:
   ```bash
   npm install
   ```
4. Set the **Start Command** to:
   ```bash
   npm start
   ```
5. Once deployed, the interactive API documentation will be available at:
   👉 `https://your-app-name.onrender.com/api-docs`
