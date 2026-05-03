// ─────────────────────────────────────────────────────────────────────────────
// NFC Device Adapter — Handles NFC card UID validation
// ─────────────────────────────────────────────────────────────────────────────
const BaseDeviceAdapter = require('./base.adapter');

class NfcAdapter extends BaseDeviceAdapter {
  constructor() {
    super('NFC_READER');
  }

  get credentialType() {
    return 'NFC_CARD';
  }

  /**
   * NFC card UIDs are hex strings, typically 4, 7, or 10 bytes.
   */
  validateCredential(credentialData) {
    if (!credentialData || typeof credentialData !== 'string') {
      return { valid: false, error: 'Credential data is required' };
    }
    const normalized = credentialData.replace(/[:\s-]/g, '').toUpperCase();
    if (!/^[0-9A-F]{8,20}$/.test(normalized)) {
      return { valid: false, error: 'Invalid NFC card UID format' };
    }
    return { valid: true, normalizedData: normalized };
  }

  /**
   * NFC credentials are written by the NFC reader hardware — not generated server-side.
   */
  get canGenerateCredential() {
    return false;
  }
}

module.exports = NfcAdapter;
