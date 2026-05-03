// ─────────────────────────────────────────────────────────────────────────────
// Base Device Adapter — Abstract interface for all device types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All device adapters implement these methods.
 * Concrete adapters: NfcAdapter, QrAdapter, FingerprintAdapter, FaceAdapter
 */
class BaseDeviceAdapter {
  constructor(deviceType) {
    this.deviceType = deviceType;
  }

  /**
   * Validate incoming credential data from the device.
   * @param {string} credentialData — raw data from the device event
   * @returns {{ valid: boolean, error?: string, normalizedData?: string }}
   */
  validateCredential(credentialData) {
    throw new Error(`${this.deviceType}: validateCredential() not implemented`);
  }

  /**
   * Generate a new credential for enrollment.
   * Some adapters (QR) can generate tokens; others (NFC) rely on external hardware.
   * @param {{ employeeId: string, orgId: string }} opts
   * @returns {Promise<{ credentialData: string, displayData?: any, expiresAt?: Date }>}
   */
  async generateCredential(_opts) {
    throw new Error(`${this.deviceType}: generateCredential() not supported`);
  }

  /**
   * Whether this adapter supports server-side credential generation.
   */
  get canGenerateCredential() {
    return false;
  }

  /**
   * Whether this adapter's credentials expire and need refresh.
   */
  get credentialExpires() {
    return false;
  }

  /**
   * Get the CredentialType enum value for Prisma.
   */
  get credentialType() {
    throw new Error(`${this.deviceType}: credentialType getter not implemented`);
  }
}

module.exports = BaseDeviceAdapter;
