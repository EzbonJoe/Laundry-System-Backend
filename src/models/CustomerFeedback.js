const mongoose = require('mongoose');

const customerFeedbackSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: String,
      enum: ['service_quality', 'turnaround_time', 'pricing', 'staff_attitude', 'cleanliness', 'general'],
      default: 'general',
    },
    isReviewed: {
      type: Boolean,
      default: false, // manager marks as reviewed
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// One feedback per order per customer
customerFeedbackSchema.index({ customer: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('CustomerFeedback', customerFeedbackSchema);