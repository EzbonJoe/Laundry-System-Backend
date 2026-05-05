const mongoose = require('mongoose');

const machineUsageLogSchema = new mongoose.Schema(
  {
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: [true, 'Machine is required'],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    operatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Operator is required'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null, // calculated when endTime is set
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto-calculate duration when endTime is set
machineUsageLogSchema.pre('save', function () {
  if (this.startTime && this.endTime) {
    this.durationMinutes = Math.round((this.endTime - this.startTime) / 60000);
  } 
});

module.exports = mongoose.model('MachineUsageLog', machineUsageLogSchema);