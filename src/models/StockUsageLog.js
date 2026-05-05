const mongoose = require('mongoose');

const stockUsageLogSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Inventory item is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null, // some usage may not be tied to a specific order
    },
    quantityUsed: {
      type: Number,
      required: [true, 'Quantity used is required'],
      min: [0.01, 'Quantity must be greater than 0'],
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member is required'],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockUsageLog', stockUsageLogSchema);