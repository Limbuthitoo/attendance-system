// ─────────────────────────────────────────────────────────────────────────────
// Platform App Update Routes — Global APK management for superadmin
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPrisma } = require('../../lib/prisma');

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
    if (
      file.originalname.endsWith('.apk') ||
      file.mimetype === 'application/vnd.android.package-archive' ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .apk files are allowed'));
    }
  },
});

// GET / — Get current release info
router.get('/current', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const release = await prisma.appRelease.findFirst({
      orderBy: { uploadedAt: 'desc' },
      include: { uploader: { select: { name: true } } },
    });

    res.json({
      release: release
        ? {
            id: release.id,
            version: release.version,
            filename: release.filename,
            file_size: release.fileSize,
            release_notes: release.releaseNotes,
            is_mandatory: release.isMandatory,
            uploaded_at: release.uploadedAt,
            uploaded_by_name: release.uploader?.name || 'Platform Admin',
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /upload — Upload new APK
router.post('/upload', (req, res) => {
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
      const prisma = getPrisma();

      // Delete old APK files
      const oldReleases = await prisma.appRelease.findMany();
      for (const old of oldReleases) {
        const oldPath = path.join(APK_DIR, old.filename);
        if (fs.existsSync(oldPath) && old.filename !== req.file.filename) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }

      // Clear all old records, keep only latest
      await prisma.appRelease.deleteMany();

      // Need a dummy orgId for the required FK — use first org
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'No organization exists yet' });
      }

      const release = await prisma.appRelease.create({
        data: {
          orgId: firstOrg.id,
          version,
          filename: req.file.filename,
          fileSize: req.file.size,
          releaseNotes: release_notes || '',
          isMandatory: is_mandatory === '1' || is_mandatory === true,
          uploadedBy: null, // platform admin, not an employee
        },
      });

      res.status(201).json({
        release: {
          id: release.id,
          version: release.version,
          filename: release.filename,
          file_size: release.fileSize,
          release_notes: release.releaseNotes,
          is_mandatory: release.isMandatory,
          uploaded_at: release.uploadedAt,
        },
      });
    } catch (error) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ error: error.message });
    }
  });
});

// DELETE /current — Delete current release
router.delete('/current', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const release = await prisma.appRelease.findFirst({
      orderBy: { uploadedAt: 'desc' },
    });

    if (release) {
      const filePath = path.join(APK_DIR, release.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
      await prisma.appRelease.delete({ where: { id: release.id } });
    }

    res.json({ message: 'Release deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
