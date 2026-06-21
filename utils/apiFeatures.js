// ES module when required becomes {default:actual fn}
const aqp = require('api-query-params').default;

// ==============================
// API FEATURES CLASS
// ==============================
// This class provides chainable methods for building complex MongoDB queries
// with filtering, sorting, field selection, and pagination.
//
// Example Usage:
// const features = new APIFeatures(Tour.find(), req.query)
//   .filter()
//   .sort()
//   .limitFields()
//   .paginate();

class APIFeatures {
  // ==============================
  // CONSTRUCTOR
  // ==============================
  // Initializes the APIFeatures instance with a Mongoose query and query parameters
  constructor(query, queryString) {
    // Mongoose query object (e.g., Tour.find())
    this.query = query;

    // Express query parameters from req.query
    // Examples: { price: { gte: 500 }, sort: 'price', page: 2 }
    this.queryString = queryString;
  }

  // ==============================
  // FILTER METHOD
  // ==============================
  // Filters documents based on query parameters
  //
  // Example query string:
  // ?price[gte]=500&difficulty=easy
  //
  // Converts to MongoDB format:
  // { price: { $gte: 500 }, difficulty: 'easy' }

  filter() {
    // ==============================
    // CONVERT OPERATORS TO MONGODB FORMAT
    // ==============================
    // Convert query operators from URL format to MongoDB format
    //
    // Example:
    // Input:  { price[gte]: 500 }
    // Output: { price: { $gte: 500 } }
    //
    // Operators: gte, gt, lte, lt
    // Replace operators: gte, gt, lte, lt with MongoDB equivalents: $gte, $gt, $lte, $lt (need to implement this)

    const filterObj = aqp(this.queryString).filter;
    // Apply filtering to mongoose query
    this.query = this.query.find(filterObj);

    // Return 'this' for method chaining
    return this;
  }

  // ==============================
  // SORT METHOD
  // ==============================
  // Sorts documents based on query parameters
  //
  // Example:
  // ?sort=-price,ratingsAverage
  // Sorts by price (descending), then by ratingsAverage (ascending)

  sort() {
    const sortBy = aqp(this.queryString).sort || '-createdAt';

    this.query = this.query.sort(sortBy);

    // Return 'this' for method chaining
    return this;
  }

  // ==============================
  // LIMIT FIELDS METHOD
  // ==============================
  // Selects specific fields to include in the response (projection)
  //
  // Example:
  // ?fields=name,price,difficulty
  // Returns only these 3 fields for each document

  limitFields() {
    // You can’t mix inclusion and exclusion in a single MongoDB projection you must either include specific fields or exclude fields, not both (except _id).
    const fields = aqp(this.queryString).projection || '-__v';

    this.query = this.query.select(fields);

    // Return 'this' for method chaining
    return this;
  }

  // ==============================
  // PAGINATE METHOD
  // ==============================
  // Implements pagination by skipping and limiting results
  //
  // Example:
  // ?page=2&limit=10
  // Returns items 11-20 (skip 10, limit 10)

  paginate() {
    // Extract page number (default: 1 if not provided)
    const page = Number(this.queryString.page) || 1;

    // Extract limit (default: 100 if not provided)
    const limit = Number(this.queryString.limit) || 100;

    // Calculate number of documents to skip
    // Page 1: skip 0, Page 2: skip 10, Page 3: skip 20, etc.
    const skip = (page - 1) * limit;

    // Apply skip and limit to query
    this.query = this.query.skip(skip).limit(limit);

    // Return 'this' for method chaining
    return this;
  }
}

// ==============================
// EXPORT
// ==============================

module.exports = APIFeatures;
