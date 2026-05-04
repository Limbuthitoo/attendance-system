const { getDB } = require('./db');

/**
 * Send push notifications via Expo Push API.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications to specific employee IDs.
 * @param {number[]} employeeIds
 * @param {{ title: string, body: string, data?: object }} notification
 */
async function sendPushToEmployees(employeeIds, { title, body, data = {} }) {
  if (!employeeIds || employeeIds.length === 0) return;

  const db = getDB();
  const placeholders = employeeIds.map(() => '?').join(',');
  const tokens = db.prepare(
    `SELECT DISTINCT token FROM push_tokens WHERE employee_id IN (${placeholders})`
  ).all(...employeeIds);

  if (tokens.length === 0) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  // Expo accepts batches of up to 100
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await res.json();
      // Clean up invalid tokens
      if (result.data) {
        result.data.forEach((receipt, i) => {
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            db.prepare('DELETE FROM push_tokens WHERE token = ?').run(chunk[i].to);
          }
        });
      }
    } catch (err) {
      console.error('Push notification failed:', err.message);
    }
  }
}

/**
 * Send push to all admin users.
 */
async function sendPushToAdmins({ title, body, data = {} }) {
  const db = getDB();
  const admins = db.prepare("SELECT id FROM employees WHERE role = 'admin' AND is_active = 1").all();
  const adminIds = admins.map(a => a.id);
  return sendPushToEmployees(adminIds, { title, body, data });
}

/**
 * Register or update a push token for an employee.
 */
function registerToken(employeeId, token, deviceName) {
  const db = getDB();
  // Upsert: insert or update timestamp
  db.prepare(`
    INSERT INTO push_tokens (employee_id, token, device_name)
    VALUES (?, ?, ?)
    ON CONFLICT(employee_id, token)
    DO UPDATE SET device_name = ?, updated_at = datetime('now')
  `).run(employeeId, token, deviceName || null, deviceName || null);
}

/**
 * Remove a push token (on logout).
 */
function removeToken(employeeId, token) {
  const db = getDB();
  db.prepare('DELETE FROM push_tokens WHERE employee_id = ? AND token = ?').run(employeeId, token);
}

module.exports = {
  sendPushToEmployees,
  sendPushToAdmins,
  registerToken,
  removeToken,
};
