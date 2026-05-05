const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['washer', 'dryer', 'iron_press', 'dry_clean_machine'],
      required: [true, 'Machine type is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    status: {
      type: String,
      enum: ['idle', 'in_use', 'maintenance', 'out_of_service'],
      default: 'idle',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: null,
    },
    lastMaintenanceDate: {
      type: Date,
      default: null,
    },
    nextMaintenanceDue: {
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

module.exports = mongoose.model('Machine', machineSchema);