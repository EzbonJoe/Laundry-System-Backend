// ─────────────────────────────────────────────
//  ORDER STATUS CONSTANTS & WORKFLOW
// ─────────────────────────────────────────────

const ORDER_STATUSES = {
  RECEIVED:    'received',
  WASHING:     'washing',
  IRONING:     'ironing',
  PACKAGING:   'packaging',
  READY:       'ready',
  COLLECTED:   'collected',
  UNCOLLECTED: 'uncollected',
};

// Defines the valid next states from each current state.
// Prevents jumping from e.g. 'received' directly to 'collected'.
const STATUS_TRANSITIONS = {
  [ORDER_STATUSES.RECEIVED]:    [ORDER_STATUSES.WASHING],
  [ORDER_STATUSES.WASHING]:     [ORDER_STATUSES.IRONING, ORDER_STATUSES.PACKAGING],
  [ORDER_STATUSES.IRONING]:     [ORDER_STATUSES.PACKAGING],
  [ORDER_STATUSES.PACKAGING]:   [ORDER_STATUSES.READY],
  [ORDER_STATUSES.READY]:       [ORDER_STATUSES.COLLECTED, ORDER_STATUSES.UNCOLLECTED],
  [ORDER_STATUSES.COLLECTED]:   [], // terminal state
  [ORDER_STATUSES.UNCOLLECTED]: [ORDER_STATUSES.COLLECTED], // can still be collected later
};

// Human-readable labels (for notifications and reports)
const STATUS_LABELS = {
  [ORDER_STATUSES.RECEIVED]:    'Order Received',
  [ORDER_STATUSES.WASHING]:     'Being Washed',
  [ORDER_STATUSES.IRONING]:     'Being Ironed',
  [ORDER_STATUSES.PACKAGING]:   'Being Packaged',
  [ORDER_STATUSES.READY]:       'Ready for Collection',
  [ORDER_STATUSES.COLLECTED]:   'Collected',
  [ORDER_STATUSES.UNCOLLECTED]: 'Uncollected',
};

/**
 * Checks if a status transition is valid.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
const isValidTransition = (currentStatus, newStatus) => {
  const allowed = STATUS_TRANSITIONS[currentStatus];
  return allowed && allowed.includes(newStatus);
};

// ─────────────────────────────────────────────
//  SERVICE TYPES
// ─────────────────────────────────────────────

const SERVICE_TYPES = {
  WASH:          'wash',
  IRON:          'iron',
  WASH_AND_IRON: 'wash_and_iron',
  DRY_CLEAN:     'dry_clean',
};

// ─────────────────────────────────────────────
//  PAYMENT STATUSES
// ─────────────────────────────────────────────

const PAYMENT_STATUSES = {
  UNPAID:  'unpaid',
  PARTIAL: 'partial',
  PAID:    'paid',
};

const PAYMENT_METHODS = {
  CASH:         'cash',
  MOBILE_MONEY: 'mobile_money',
  CARD:         'card',
};

module.exports = {
  ORDER_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  isValidTransition,
  SERVICE_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
};