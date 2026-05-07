// ─────────────────────────────────────────────────────────────────────────────
// Seed Device Catalog — Creates default categories, brands, and models
// Run: node server/src/seeds/seed-device-catalog.js
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { getPrisma, disconnectPrisma } = require('../lib/prisma');

async function seedDeviceCatalog() {
  const prisma = getPrisma();
  console.log('🔧 Seeding device catalog...\n');

  // ─── Categories ───────────────────────────────────────────────────────────
  const categories = [
    { key: 'NFC_RFID', name: 'NFC / RFID', icon: 'credit-card' },
    { key: 'FINGERPRINT', name: 'Fingerprint Scanner', icon: 'fingerprint' },
    { key: 'FACE_RECOGNITION', name: 'Face Recognition', icon: 'scan-face' },
    { key: 'QR_CODE', name: 'QR Code', icon: 'qr-code' },
    { key: 'MOBILE_GPS', name: 'Mobile GPS', icon: 'smartphone' },
    { key: 'WEB_CHECKIN', name: 'Web Check-in', icon: 'monitor' },
    { key: 'ACCESS_CONTROL', name: 'Access Control', icon: 'lock' },
    { key: 'GENERIC_HTTP', name: 'Generic HTTP / Webhook', icon: 'webhook' },
    { key: 'CSV_IMPORT', name: 'CSV / File Import', icon: 'file-spreadsheet' },
    { key: 'HYBRID_BIOMETRIC', name: 'Hybrid Biometric', icon: 'scan' },
  ];

  for (const cat of categories) {
    await prisma.deviceCategory.upsert({
      where: { key: cat.key },
      create: cat,
      update: { name: cat.name, icon: cat.icon },
    });
  }
  console.log(`  ✓ ${categories.length} categories`);

  // ─── Brands ───────────────────────────────────────────────────────────────
  const brands = [
    { name: 'Generic PC/SC', website: null },
    { name: 'ACS', website: 'https://www.acs.com.hk' },
    { name: 'ZKTeco', website: 'https://www.zkteco.com' },
    { name: 'Hikvision', website: 'https://www.hikvision.com' },
    { name: 'eSSL', website: 'https://www.esslindia.com' },
    { name: 'Suprema', website: 'https://www.supremainc.com' },
    { name: 'Anviz', website: 'https://www.anviz.com' },
    { name: 'Archisys', website: null },
  ];

  for (const brand of brands) {
    await prisma.deviceBrand.upsert({
      where: { name: brand.name },
      create: brand,
      update: { website: brand.website },
    });
  }
  console.log(`  ✓ ${brands.length} brands`);

  // ─── Models ───────────────────────────────────────────────────────────────
  const nfcCategory = await prisma.deviceCategory.findUnique({ where: { key: 'NFC_RFID' } });
  const genericBrand = await prisma.deviceBrand.findUnique({ where: { name: 'Generic PC/SC' } });
  const acsBrand = await prisma.deviceBrand.findUnique({ where: { name: 'ACS' } });
  const archisysBrand = await prisma.deviceBrand.findUnique({ where: { name: 'Archisys' } });
  const qrCategory = await prisma.deviceCategory.findUnique({ where: { key: 'QR_CODE' } });
  const mobileCategory = await prisma.deviceCategory.findUnique({ where: { key: 'MOBILE_GPS' } });
  const webCategory = await prisma.deviceCategory.findUnique({ where: { key: 'WEB_CHECKIN' } });

  const models = [
    {
      categoryId: nfcCategory.id,
      brandId: genericBrand.id,
      name: 'PC/SC NFC Reader',
      connectionType: 'LOCAL_PCSC',
      syncMode: 'PUSH',
      capabilities: { supports_realtime: true, supports_card: true, supports_health_check: true },
      supportedActions: ['CHECK_IN', 'CHECK_OUT'],
    },
    {
      categoryId: nfcCategory.id,
      brandId: acsBrand.id,
      name: 'ACR122U',
      connectionType: 'LOCAL_PCSC',
      syncMode: 'PUSH',
      capabilities: { supports_realtime: true, supports_card: true, supports_health_check: true },
      supportedActions: ['CHECK_IN', 'CHECK_OUT'],
    },
    {
      categoryId: qrCategory.id,
      brandId: archisysBrand.id,
      name: 'QR Terminal',
      connectionType: 'HTTP_API',
      syncMode: 'PUSH',
      capabilities: { supports_realtime: true, supports_qr: true },
      supportedActions: ['CHECK_IN', 'CHECK_OUT'],
    },
    {
      categoryId: mobileCategory.id,
      brandId: archisysBrand.id,
      name: 'Mobile App',
      connectionType: 'HTTP_API',
      syncMode: 'PUSH',
      capabilities: { supports_realtime: true },
      supportedActions: ['CHECK_IN', 'CHECK_OUT'],
    },
    {
      categoryId: webCategory.id,
      brandId: archisysBrand.id,
      name: 'Web Portal',
      connectionType: 'HTTP_API',
      syncMode: 'PUSH',
      capabilities: { supports_realtime: true },
      supportedActions: ['CHECK_IN', 'CHECK_OUT'],
    },
  ];

  for (const model of models) {
    const existing = await prisma.deviceModel.findFirst({
      where: { brandId: model.brandId, name: model.name },
    });
    if (!existing) {
      await prisma.deviceModel.create({ data: model });
    }
  }
  console.log(`  ✓ ${models.length} models (upserted)`);

  // ─── Link existing NFC devices to the PC/SC model ─────────────────────────
  const pcscModel = await prisma.deviceModel.findFirst({
    where: { brandId: genericBrand.id, name: 'PC/SC NFC Reader' },
  });

  if (pcscModel) {
    const result = await prisma.device.updateMany({
      where: { deviceType: 'NFC_READER', modelId: null },
      data: { modelId: pcscModel.id },
    });
    if (result.count > 0) {
      console.log(`  ✓ Linked ${result.count} existing NFC reader(s) to '${pcscModel.name}' model`);
    }
  }

  console.log('\n✅ Device catalog seeded successfully');
  await disconnectPrisma();
}

seedDeviceCatalog().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
