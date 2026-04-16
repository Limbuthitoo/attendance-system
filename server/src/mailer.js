const nodemailer = require('nodemailer');

// SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@archisysinnovation.com';

let transporter = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send an email. Fails silently (logs error) so it never blocks API responses.
 */
async function sendMail({ to, subject, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('⚠  Email not sent — SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.');
    return false;
  }

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

/**
 * Notify admin about a new leave application.
 */
function sendLeaveApplicationEmail({ employeeName, empCode, department, leaveType, startDate, endDate, days, reason }) {
  const subject = `Leave Application — ${employeeName} (${empCode})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">New Leave Application</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Employee</td>
            <td style="padding: 8px 0; font-weight: 600;">${employeeName} (${empCode})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Department</td>
            <td style="padding: 8px 0;">${department || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Leave Type</td>
            <td style="padding: 8px 0; text-transform: capitalize;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Duration</td>
            <td style="padding: 8px 0;">${startDate} to ${endDate} (${days} day${days > 1 ? 's' : ''})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Reason</td>
            <td style="padding: 8px 0;">${reason}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          Please log in to the admin dashboard to approve or reject this request.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        Archisys Innovations — Attendance Management System
      </p>
    </div>
  `;

  // Fire and forget — don't block the API response
  sendMail({ to: NOTIFY_EMAIL, subject, html });
}

module.exports = { sendMail, sendLeaveApplicationEmail, NOTIFY_EMAIL };
