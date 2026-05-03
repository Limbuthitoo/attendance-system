// ─────────────────────────────────────────────────────────────────────────────
// QR Code Device Adapter — Time-limited QR tokens for check-in/out
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');
const BaseDeviceAdapter = require('./base.adapter');

const QR_TOKEN_BYTES = 32;
const QR_DEFAULT_TTL_SECONDS = 30; // QR codes valid for 30 seconds

class QrAdapter extends BaseDeviceAdapter {
  constructor() {
    super('QR_TERMINAL');
  }

  get credentialType() {
    return 'QR_CODE';
  }

  get canGenerateCredential() {
    return true;
  }

  get credentialExpires() {
    return true;
  }

  /**
   * Validate a QR token string — format: "qr_<hex64>".
   */
  validateCredential(credentialData) {
    if (!credentialData || typeof credentialData !== 'string') {
      return { valid: false, error: 'Credential data is required' };
    }
    if (!/^qr_[0-9a-f]{64}$/.test(credentialData)) {
      return { valid: false, error: 'Invalid QR token format' };
    }
    return { valid: true, normalizedData: credentialData };
  }

  /**
   * Generate a time-limited QR token for an employee.
   * The token is stored as a credential with an expiry and is single-use.
   */
  async generateCredential({ employeeId, orgId, ttlSeconds }) {
    const ttl = ttlSeconds || QR_DEFAULT_TTL_SECONDS;
    const token = `qr_${crypto.randomBytes(QR_TOKEN_BYTES).toString('hex')}`;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    return {
      credentialData: token,
      expiresAt,
      ttlSeconds: ttl,
    };
  }
}

module.exports = QrAdapter;
