const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    loyaltyStatus: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastOrderDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Mark customer inactive if no order in 90 days
customerSchema.methods.updateLoyaltyStatus = function () {
  if (!this.lastOrderDate) {
    this.loyaltyStatus = 'inactive';
    return;
  }
  const daysSinceLastOrder = (Date.now() - this.lastOrderDate) / (1000 * 60 * 60 * 24);
  this.loyaltyStatus = daysSinceLastOrder > 90 ? 'inactive' : 'active';
};

module.exports = mongoose.model('Customer', customerSchema);