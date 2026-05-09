const nodemailer = require('nodemailer');

// SMTP configuration from environment variables (fallback)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@archisysinnovation.com';

let envTransporter = null;
const orgTransporters = new Map(); // orgId -> { transporter, createdAt }

const ORG_TRANSPORTER_TTL = 5 * 60 * 1000; // 5 minutes cache

function getEnvTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!envTransporter) {
    envTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return envTransporter;
}

/**
 * Get SMTP config for an org from OrgSettings, falling back to env vars.
 */
async function getOrgSmtpConfig(orgId) {
  if (!orgId) return null;
  try {
    const { getPrisma } = require('./lib/prisma');
    const prisma = getPrisma();
    const rows = await prisma.orgSetting.findMany({
      where: { orgId, key: { startsWith: 'smtp_' } },
    });
    const cfg = {};
    for (const r of rows) cfg[r.key] = r.value;

    if (cfg.smtp_host && cfg.smtp_user && cfg.smtp_pass) {
      return {
        host: cfg.smtp_host,
        port: parseInt(cfg.smtp_port) || 587,
        user: cfg.smtp_user,
        pass: cfg.smtp_pass,
        from: cfg.smtp_from || cfg.smtp_user,
        notifyEmail: cfg.smtp_notify_email || '',
      };
    }
  } catch (err) {
    console.error('Failed to load org SMTP config:', err.message);
  }
  return null;
}

/**
 * Get a transporter for an org (cached), falling back to env transporter.
 */
async function getTransporter(orgId) {
  // Try org-specific config
  if (orgId) {
    const cached = orgTransporters.get(orgId);
    if (cached && Date.now() - cached.createdAt < ORG_TRANSPORTER_TTL) {
      return { transporter: cached.transporter, from: cached.from };
    }

    const cfg = await getOrgSmtpConfig(orgId);
    if (cfg) {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      orgTransporters.set(orgId, { transporter, from: cfg.from, createdAt: Date.now() });
      return { transporter, from: cfg.from };
    }
  }

  // Fallback to env
  const t = getEnvTransporter();
  return t ? { transporter: t, from: SMTP_FROM } : null;
}

/**
 * Get the notify email for an org.
 */
async function getNotifyEmail(orgId) {
  if (orgId) {
    const cfg = await getOrgSmtpConfig(orgId);
    if (cfg && cfg.notifyEmail) return cfg.notifyEmail;
  }
  return NOTIFY_EMAIL;
}

/**
 * Invalidate cached transporter for an org (call after SMTP settings change).
 */
function invalidateOrgTransporter(orgId) {
  orgTransporters.delete(orgId);
}

/**
 * Send an email. Fails silently (logs error) so it never blocks API responses.
 */
async function sendMail({ to, subject, html, orgId }) {
  const result = await getTransporter(orgId);
  if (!result) {
    console.warn('⚠  Email not sent — SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars or configure in dashboard.');
    return false;
  }

  try {
    await result.transporter.sendMail({
      from: result.from,
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
async function sendLeaveApplicationEmail({ employeeName, empCode, department, leaveType, startDate, endDate, days, reason, orgId }) {
  const appUrl = process.env.CORS_ORIGIN || 'https://hr.bijaysubbalimbu.com.np';
  const leaveUrl = `${appUrl}/leave-management`;
  const subject = `Leave Application — ${employeeName} (${empCode})`;

  const leaveColors = {
    sick: { bg: '#fef2f2', text: '#991b1b', badge: '#fecaca' },
    casual: { bg: '#eff6ff', text: '#1e40af', badge: '#bfdbfe' },
    annual: { bg: '#f0fdf4', text: '#166534', badge: '#bbf7d0' },
    unpaid: { bg: '#fefce8', text: '#854d0e', badge: '#fef08a' },
  };
  const colors = leaveColors[leaveType?.toLowerCase()] || leaveColors.casual;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

            <!-- Logo -->
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <span style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: 700; color: #1e40af; letter-spacing: -0.5px;">
                ◆ Archisys Innovations
              </span>
            </td></tr>

            <!-- Main Card -->
            <tr><td style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                <!-- Header Banner -->
                <tr><td style="background: #1e40af; padding: 32px 36px;">
                  <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 13px; font-weight: 600; color: #93c5fd; text-transform: uppercase; letter-spacing: 1.5px;">New Request</p>
                  <h1 style="font-family: 'Segoe UI', Arial, sans-serif; margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #ffffff;">Leave Application</h1>
                </td></tr>

                <!-- Employee Card -->
                <tr><td style="padding: 28px 36px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <tr>
                      <td style="padding: 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="width: 48px; height: 48px; background: #1e40af; border-radius: 50%; text-align: center; vertical-align: middle;">
                              <span style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff;">${employeeName.charAt(0).toUpperCase()}</span>
                            </td>
                            <td style="padding-left: 16px;">
                              <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${employeeName}</p>
                              <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 4px 0 0; font-size: 13px; color: #64748b;">${empCode} &nbsp;·&nbsp; ${department || 'N/A'}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Leave Details -->
                <tr><td style="padding: 24px 36px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                    <!-- Leave Type & Duration Row -->
                    <tr>
                      <td width="50%" style="padding-right: 8px; padding-bottom: 12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${colors.bg}; border-radius: 10px; border: 1px solid ${colors.badge};">
                          <tr><td style="padding: 16px 18px;">
                            <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Leave Type</p>
                            <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 6px 0 0; font-size: 16px; font-weight: 700; color: ${colors.text}; text-transform: capitalize;">${leaveType}</p>
                          </td></tr>
                        </table>
                      </td>
                      <td width="50%" style="padding-left: 8px; padding-bottom: 12px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fefce8; border-radius: 10px; border: 1px solid #fef08a;">
                          <tr><td style="padding: 16px 18px;">
                            <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                            <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 6px 0 0; font-size: 16px; font-weight: 700; color: #854d0e;">${days} Day${days > 1 ? 's' : ''}</p>
                          </td></tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Date Range -->
                    <tr><td colspan="2" style="padding-bottom: 12px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <tr><td style="padding: 16px 18px;">
                          <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Period</p>
                          <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                            ${startDate} &nbsp;→&nbsp; ${endDate}
                          </p>
                        </td></tr>
                      </table>
                    </td></tr>

                    <!-- Reason -->
                    <tr><td colspan="2">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <tr><td style="padding: 16px 18px;">
                          <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
                          <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 8px 0 0; font-size: 14px; color: #334155; line-height: 1.6;">${reason}</p>
                        </td></tr>
                      </table>
                    </td></tr>

                  </table>
                </td></tr>

                <!-- CTA Button -->
                <tr><td style="padding: 28px 36px 32px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: #1e40af; border-radius: 10px;">
                        <a href="${leaveUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">
                          Review &amp; Respond &nbsp;→
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-family: 'Segoe UI', Arial, sans-serif; margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
                    Or go to <a href="${leaveUrl}" style="color: #3b82f6; text-decoration: underline;">${leaveUrl}</a>
                  </p>
                </td></tr>

              </table>
            </td></tr>

            <!-- Footer -->
            <tr><td style="padding: 24px 16px; text-align: center;">
              <p style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #94a3b8; margin: 0;">
                Archisys Innovations — Attendance Management System
              </p>
              <p style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #cbd5e1; margin: 6px 0 0;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td></tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  // Route through the email queue for retries and reliability
  const notifyTo = await getNotifyEmail(orgId);
  const { enqueueEmail } = require('./config/queue');
  enqueueEmail({ to: notifyTo, subject, html, orgId }).catch(err => {
    console.error('Failed to enqueue leave email:', err.message);
    // Fallback: fire and forget directly
    sendMail({ to: notifyTo, subject, html, orgId });
  });
}

module.exports = { sendMail, sendLeaveApplicationEmail, getNotifyEmail, getOrgSmtpConfig, invalidateOrgTransporter, NOTIFY_EMAIL };
