const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────
//  EMAIL — via Nodemailer (SMTP)
// ─────────────────────────────────────────────

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send an email.
 * @param {Object} options - { to, subject, text, html }
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });

    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    // Don't throw — notifications should never crash a request
  }
};

// ─────────────────────────────────────────────
//  SMS — via Africa's Talking
// ─────────────────────────────────────────────

/**
 * Send an SMS via Africa's Talking.
 * @param {string} phone   - Recipient phone number (e.g. +256712345678)
 * @param {string} message - SMS message content
 */
const sendSMS = async (phone, message) => {
  try {
    const AfricasTalking = require('africastalking')({
      apiKey:   process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });

    const sms = AfricasTalking.SMS;

    await sms.send({
      to:      [phone],
      message,
      from:    process.env.AT_SENDER_ID,
    });

    console.log(`📱 SMS sent to ${phone}`);
  } catch (err) {
    console.error('❌ SMS failed:', err.message);
    // Don't throw — notifications should never crash a request
  }
};

// ─────────────────────────────────────────────
//  NOTIFICATION TEMPLATES
// ─────────────────────────────────────────────

const notifyOrderReady = async (customer, order) => {
  const message = `Hello ${customer.name}, your laundry order #${order.orderNumber} is ready for collection at Ezbon Laundry. Thank you!`;

  if (customer.phone) await sendSMS(customer.phone, message);
  if (customer.email) {
    await sendEmail({
      to:      customer.email,
      subject: `Your Order ${order.orderNumber} is Ready`,
      text:    message,
      html:    `<p>${message}</p>`,
    });
  }
};

const notifyLowStock = async (staffEmail, itemName, branchName, currentStock, unit) => {
  const message = `Low stock alert: "${itemName}" at ${branchName} is down to ${currentStock} ${unit}. Please restock soon.`;

  if (staffEmail) {
    await sendEmail({
      to:      staffEmail,
      subject: `⚠️ Low Stock Alert — ${itemName}`,
      text:    message,
      html:    `<p>${message}</p>`,
    });
  }
};

module.exports = {
  sendEmail,
  sendSMS,
  notifyOrderReady,
  notifyLowStock,
};