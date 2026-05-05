const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['shirt', 'trouser', 'dress', 'suit', 'bedsheet', 'towel', 'jacket', 'other'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    serviceType: {
      type: String,
      enum: ['wash', 'iron', 'wash_and_iron', 'dry_clean'],
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      // auto-generated in pre-save hook below
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
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiving staff member is required'],
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (val) => val.length > 0,
        message: 'Order must have at least one item',
      },
    },
    status: {
      type: String,
      enum: ['received', 'washing', 'ironing', 'packaging', 'ready', 'collected', 'uncollected'],
      default: 'received',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'card', null],
      default: null,
    },
    collectionType: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup',
    },
    deliveryAddress: {
      type: String,
      trim: true,
      default: null,
    },
    expectedReadyDate: {
      type: Date,
      default: null,
    },
    collectedAt: {
      type: Date,
      default: null,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function () {
  // Auto-generate order number for new orders
  if (this.isNew) {
    const now = new Date();
    const year = now.getFullYear();
    const count = await mongoose.model('Order').countDocuments();
    const padded = String(count + 1).padStart(5, '0');
    this.orderNumber = `EZB-${year}-${padded}`;
  }

  // Auto-update payment status
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
});

module.exports = mongoose.model('Order', orderSchema);