// ==============================
// IMPORTS
// ==============================

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');

/*
|--------------------------------------------------------------------------
| HANDLER FACTORY
|--------------------------------------------------------------------------
| Centralized generic controller functions to handle standard CRUD operations
| across all models. This eliminates code duplication for basic endpoints.
*/

// ==============================
// CREATE ONE DOCUMENT
// ==============================
// Generic factory function to create a new document in the database

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

// ==============================
// GET ONE DOCUMENT
// ==============================
// Generic factory function to retrieve a single document by its ID

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);

    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

// ==============================
// GET ALL DOCUMENTS
// ==============================
// Generic factory function to retrieve all documents for a given model

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};

    if (req.params.programId) {
      filter = { program: req.params.programId };
    }

    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const doc = await features.query;

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });

// ==============================
// UPDATE ONE DOCUMENT
// ==============================
// Generic factory function to update a single document by its ID

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

// ==============================
// DELETE ONE DOCUMENT
// ==============================
// Generic factory function to delete a single document by its ID

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
