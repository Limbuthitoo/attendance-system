// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint Device Adapter — Handles fingerprint template validation
// ─────────────────────────────────────────────────────────────────────────────
const BaseDeviceAdapter = require('./base.adapter');

class FingerprintAdapter extends BaseDeviceAdapter {
  constructor() {
    super('FINGERPRINT');
  }

  get credentialType() {
    return 'FINGERPRINT';
  }

  /**
   * Fingerprint credentials are opaque template IDs assigned by the scanner hardware.
   * We store the template reference / hash — the actual biometric matching is done on-device.
   */
  validateCredential(credentialData) {
    if (!credentialData || typeof credentialData !== 'string') {
      return { valid: false, error: 'Credential data is required' };
    }
    // Template IDs are alphanumeric, min 4 chars
    const normalized = credentialData.trim();
    if (normalized.length < 4 || normalized.length > 256) {
      return { valid: false, error: 'Fingerprint template ID must be 4-256 characters' };
    }
    return { valid: true, normalizedData: normalized };
  }

  /**
   * Fingerprint credentials are enrolled on the physical device, not generated server-side.
   */
  get canGenerateCredential() {
    return false;
  }
}

module.exports = FingerprintAdapter;
