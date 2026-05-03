// ─────────────────────────────────────────────────────────────────────────────
// Face Recognition Device Adapter — Handles face ID template validation
// ─────────────────────────────────────────────────────────────────────────────
const BaseDeviceAdapter = require('./base.adapter');

class FaceAdapter extends BaseDeviceAdapter {
  constructor() {
    super('FACE_RECOGNITION');
  }

  get credentialType() {
    return 'FACE_ID';
  }

  /**
   * Face recognition uses an opaque template/enrollment ID from the device SDK.
   * Matching is done on-device or by the vendor's cloud service.
   */
  validateCredential(credentialData) {
    if (!credentialData || typeof credentialData !== 'string') {
      return { valid: false, error: 'Credential data is required' };
    }
    const normalized = credentialData.trim();
    if (normalized.length < 4 || normalized.length > 512) {
      return { valid: false, error: 'Face template ID must be 4-512 characters' };
    }
    return { valid: true, normalizedData: normalized };
  }

  /**
   * Face credentials are enrolled on the device/kiosk camera, not generated server-side.
   */
  get canGenerateCredential() {
    return false;
  }
}

module.exports = FaceAdapter;
