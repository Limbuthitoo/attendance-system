// ─────────────────────────────────────────────────────────────────────────────
// Adapter Registry — Maps DeviceType → adapter instance
// ─────────────────────────────────────────────────────────────────────────────
const NfcAdapter = require('./nfc.adapter');
const QrAdapter = require('./qr.adapter');
const FingerprintAdapter = require('./fingerprint.adapter');
const FaceAdapter = require('./face.adapter');

const adapters = {
  NFC_READER: new NfcAdapter(),
  QR_TERMINAL: new QrAdapter(),
  FINGERPRINT: new FingerprintAdapter(),
  FACE_RECOGNITION: new FaceAdapter(),
};

/**
 * Get the adapter for a given device type.
 * @param {string} deviceType — DeviceType enum value
 * @returns {import('./base.adapter')}
 */
function getAdapter(deviceType) {
  const adapter = adapters[deviceType];
  if (!adapter) {
    throw new Error(`No adapter registered for device type: ${deviceType}`);
  }
  return adapter;
}

/**
 * Get the adapter for a given credential type.
 */
function getAdapterByCredentialType(credentialType) {
  for (const adapter of Object.values(adapters)) {
    if (adapter.credentialType === credentialType) return adapter;
  }
  throw new Error(`No adapter registered for credential type: ${credentialType}`);
}

/**
 * List all supported device types with adapter metadata.
 */
function listAdapters() {
  return Object.entries(adapters).map(([deviceType, adapter]) => ({
    deviceType,
    credentialType: adapter.credentialType,
    canGenerateCredential: adapter.canGenerateCredential,
    credentialExpires: adapter.credentialExpires,
  }));
}

module.exports = {
  getAdapter,
  getAdapterByCredentialType,
  listAdapters,
};
