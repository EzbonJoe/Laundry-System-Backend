const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      unique: true,
      // auto-generated in pre-save hook
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    method: {
      type: String,
      enum: ['cash', 'mobile_money', 'card'],
      required: [true, 'Payment method is required'],
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member is required'],
    },
    isFlagged: {
      type: Boolean,
      default: false, // flagged if amount doesn't match order total
    },
    flagReason: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto-generate receipt number before saving
paymentSchema.pre('save', async function () {
  if (!this.isNew) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const count = await mongoose.model('Payment').countDocuments();
  const padded = String(count + 1).padStart(5, '0');
  this.receiptNumber = `RCT-${year}${month}-${padded}`;
});

module.exports = mongoose.model('Payment', paymentSchema);