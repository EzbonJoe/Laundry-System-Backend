const mongoose = require('mongoose');

const restockLogSchema = new mongoose.Schema(
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
    quantityAdded: {
      type: Number,
      required: [true, 'Quantity added is required'],
      min: [0.01, 'Quantity must be greater than 0'],
    },
    supplier: {
      type: String,
      trim: true,
      default: null,
    },
    cost: {
      type: Number,
      min: 0,
      default: 0,
    },
    restockedBy: {
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

module.exports = mongoose.model('RestockLog', restockLogSchema);