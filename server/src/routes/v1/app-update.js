// ─────────────────────────────────────────────────────────────────────────────
// App Update Routes (v1) — Mobile APK management (Prisma/multi-tenant)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../../middleware/auth');
const { tenantContext } = require('../../middleware/tenantContext');
const prisma = require('../../lib/prisma').getPrisma();

const router = Router();

const APK_DIR = path.join(__dirname, '..', '..', '..', 'data', 'apk');
if (!fs.existsSync(APK_DIR)) {
  fs.mkdirSync(APK_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, APK_DIR),
    filename: (req, file, cb) => {
      const version = req.body.version || 'unknown';
      const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '');
      cb(null, `app-${safeVersion}.apk`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.apk') || file.mimetype === 'application/vnd.android.package-archive' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .apk files are allowed'));
    }
  },
});

function isVersionGreater(v1, v2) {
  if (!v1 || !v2) return false;
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// GET /check — public, no auth (mobile calls on launch)
// Needs orgId via query param or header for multi-tenant
router.get('/check', async (req, res, next) => {
  try {
    // Determine org context from header or auth token
    let orgId = req.headers['x-org-id'];
    if (!orgId) {
      // Try auth token
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = require('jsonwebtoken').verify(authHeader.slice(7), require('../../config').jwtSecret);
          if (decoded.id) {
            const emp = await prisma.employee.findUnique({ where: { id: decoded.id }, select: { orgId: true } });
            if (emp) orgId = emp.orgId;
          }
        } catch {}
      }
    }

    const where = orgId ? { orgId } : {};

    const latest = await prisma.appRelease.findFirst({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    if (!latest) {
      return res.json({ update_available: false });
    }

    const currentVersion = req.query.current_version;
    const updateAvailable = currentVersion ? isVersionGreater(latest.version, currentVersion) : false;

    res.json({
      update_available: updateAvailable,
      version: latest.version,
      release_notes: latest.releaseNotes,
      is_mandatory: latest.isMandatory,
      file_size: latest.fileSize,
      uploaded_at: latest.uploadedAt,
      download_url: '/api/v1/app-update/download',
    });
  } catch (err) { next(err); }
});

// GET /download — public
router.get('/download', async (req, res, next) => {
  try {
    let orgId = req.headers['x-org-id'];
    if (!orgId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = require('jsonwebtoken').verify(authHeader.slice(7), require('../../config').jwtSecret);
          if (decoded.id) {
            const emp = await prisma.employee.findUnique({ where: { id: decoded.id }, select: { orgId: true } });
            if (emp) orgId = emp.orgId;
          }
        } catch {}
      }
    }
    const where = orgId ? { orgId } : {};
    const latest = await prisma.appRelease.findFirst({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    if (!latest || !latest.filename) {
      return res.status(404).json({ error: 'No release available' });
    }

    const filePath = path.join(APK_DIR, latest.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'APK file not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);
    res.setHeader('Content-Length', latest.fileSize);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// POST /upload — admin only (auth + tenant required)
router.post('/upload', authenticate, tenantContext, requireRole('org_admin'), (req, res) => {
  upload.single('apk')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'APK file is required' });
    }

    const { version, release_notes, is_mandatory } = req.body;
    if (!version) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Version is required' });
    }

    try {
      // Delete old APK files
      const oldReleases = await prisma.appRelease.findMany({ where: { orgId: req.orgId } });
      for (const old of oldReleases) {
        const oldPath = path.join(APK_DIR, old.filename);
        if (fs.existsSync(oldPath) && old.filename !== req.file.filename) {
          fs.unlinkSync(oldPath);
        }
      }

      // Delete old records, insert new
      await prisma.appRelease.deleteMany({ where: { orgId: req.orgId } });

      const release = await prisma.appRelease.create({
        data: {
          orgId: req.orgId,
          version,
          filename: req.file.filename,
          fileSize: req.file.size,
          releaseNotes: release_notes || '',
          isMandatory: is_mandatory === '1' || is_mandatory === true,
          uploadedBy: req.user.id,
        },
      });

      res.status(201).json({ release });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message });
    }
  });
});

// GET /current — admin
router.get('/current', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const release = await prisma.appRelease.findFirst({
      where: { orgId: req.orgId },
      orderBy: { uploadedAt: 'desc' },
      include: { uploader: { select: { name: true } } },
    });

    res.json({
      release: release ? {
        ...release,
        uploaded_by_name: release.uploader?.name,
      } : null,
    });
  } catch (err) { next(err); }
});

// DELETE /current — admin
router.delete('/current', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const release = await prisma.appRelease.findFirst({
      where: { orgId: req.orgId },
      orderBy: { uploadedAt: 'desc' },
    });

    if (release) {
      const filePath = path.join(APK_DIR, release.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await prisma.appRelease.delete({ where: { id: release.id } });
    }

    res.json({ message: 'Release deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
