const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'CREATE_ORDER', 'UPDATE_ORDER_STATUS', 'RECORD_PAYMENT', 'DELETE_EXPENSE'
    },
    entity: {
      type: String,
      required: true,
      enum: ['Order', 'Payment', 'Customer', 'User', 'Branch', 'InventoryItem', 'Expense', 'Machine'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    before: {
      type: mongoose.Schema.Types.Mixed, // snapshot of record before change
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed, // snapshot of record after change
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    // Audit logs must never be modified — enforce read-only at schema level
  }
);

// Prevent updates to audit logs
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('Audit logs cannot be modified');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);