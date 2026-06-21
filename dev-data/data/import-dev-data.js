const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Program = require(`${__dirname}/../../models/programModel`);
const Review = require(`${__dirname}/../../models/reviewModel`);
const User = require(`${__dirname}/../../models/userModel`);

// Load environment variables from config.env
dotenv.config({ path: `${__dirname}/../../config.env` });

// Replace connection string password placeholder with the real secret
const db = process.env.DATABASE.replace(
  '<db_password>',
  process.env.DATABASE_PASSWORD,
);

// Connect to MongoDB using Mongoose
mongoose
  .connect(db)
  .then(() => console.log('DB Connection Successful!'))
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

// READ DATA
const programs = JSON.parse(
  fs.readFileSync(`${__dirname}/programs.json`, 'utf-8'),
);
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8'),
);
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    // insertMany bypasses standard validation rules by default and is much faster
    await Program.insertMany(programs);
    await Review.insertMany(reviews);
    await User.insertMany(users);

    console.log('Data imported successfully ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error occurred in importing ❌', err);
    process.exit(1); // Exit with a failure code
  }
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Program.deleteMany();
    await Review.deleteMany();
    await User.deleteMany();

    console.log('Data deleted Successfully 🗑️');
    process.exit(0);
  } catch (err) {
    console.error('Error occurred in deleting ❌', err);
    process.exit(1); // Exit with a failure code
  }
};

// Execution mapping
if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
} else {
  console.log('Please provide a valid flag: --import or --delete');
  process.exit(0);
}
