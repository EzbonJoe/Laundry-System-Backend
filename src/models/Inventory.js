const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['detergent', 'softener', 'packaging', 'hangers', 'tags', 'other'],
      required: [true, 'Category is required'],
    },
    unit: {
      type: String,
      enum: ['litres', 'kg', 'pieces', 'rolls', 'boxes'],
      required: [true, 'Unit is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minimumStockLevel: {
      type: Number,
      required: true,
      min: 0,
      default: 5, // triggers low stock alert
    },
    isLowStock: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-update isLowStock flag whenever stock changes
inventoryItemSchema.pre('save', function () {
  this.isLowStock = this.currentStock <= this.minimumStockLevel;
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);