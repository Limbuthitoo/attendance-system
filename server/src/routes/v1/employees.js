// ─────────────────────────────────────────────────────────────────────────────
// Employee Routes (v1) — CRUD, profile, assignment
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../../middleware/auth');
const employeeService = require('../../services/employee.service');
const authService = require('../../services/auth.service');
const prisma = require('../../lib/prisma').getPrisma();

const router = Router();

// ── Document upload setup ───────────────────────────────────────────────────
const docDir = path.join(__dirname, '..', '..', '..', 'data', 'documents');
if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

const docUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, docDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/\.(pdf|png|jpg|jpeg|doc|docx|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and document files are allowed'));
    }
  },
});

// GET /api/v1/employees — List employees (admin)
router.get('/', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { search, department, isActive, page, limit } = req.query;
    const result = await employeeService.listEmployees({
      orgId: req.orgId,
      search,
      department,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/employees/:id — Get employee detail
router.get('/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployee(req.params.id, req.orgId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/employees — Create employee (admin)
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee({
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ employee, message: 'Employee created' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/employees/:id — Update employee (admin)
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const employee = await employeeService.updateEmployee({
      employeeId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ employee, message: 'Employee updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/employees/:id/reset-password — Admin reset password
router.post('/:id/reset-password', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required' });
    }

    await authService.adminResetPassword({
      adminId: req.user.id,
      employeeId: req.params.id,
      newPassword,
      req,
    });

    res.json({ message: 'Password reset. Employee must change on next login.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/employees/:id/unlock — Admin unlock a locked account
router.post('/:id/unlock', requireRole('org_admin'), async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      select: { id: true, name: true, lockedUntil: true, failedLoginAttempts: true },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    await prisma.employee.update({
      where: { id: employee.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    res.json({ message: `Account for ${employee.name} has been unlocked.` });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/employees/:id — Permanently delete employee (admin)
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await employeeService.deleteEmployee({
      employeeId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Emergency Contacts ──────────────────────────────────────────────────────

// GET /api/v1/employees/:id/emergency-contacts
router.get('/:id/emergency-contacts', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const contacts = await prisma.emergencyContact.findMany({
      where: { employeeId: req.params.id, orgId: req.orgId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ contacts });
  } catch (err) { next(err); }
});

// POST /api/v1/employees/:id/emergency-contacts
router.post('/:id/emergency-contacts', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { name, relationship, phone, email, isPrimary } = req.body;
    if (!name || !relationship || !phone) {
      return res.status(400).json({ error: 'name, relationship, and phone are required' });
    }
    const contact = await prisma.emergencyContact.create({
      data: {
        orgId: req.orgId,
        employeeId: req.params.id,
        name,
        relationship,
        phone,
        email: email || null,
        isPrimary: !!isPrimary,
      },
    });
    res.status(201).json({ contact, message: 'Emergency contact added' });
  } catch (err) { next(err); }
});

// PUT /api/v1/employees/:id/emergency-contacts/:contactId
router.put('/:id/emergency-contacts/:contactId', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { name, relationship, phone, email, isPrimary } = req.body;
    const contact = await prisma.emergencyContact.updateMany({
      where: { id: req.params.contactId, employeeId: req.params.id, orgId: req.orgId },
      data: {
        ...(name && { name }),
        ...(relationship && { relationship }),
        ...(phone && { phone }),
        ...(email !== undefined && { email: email || null }),
        ...(isPrimary !== undefined && { isPrimary: !!isPrimary }),
      },
    });
    if (contact.count === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Contact updated' });
  } catch (err) { next(err); }
});

// DELETE /api/v1/employees/:id/emergency-contacts/:contactId
router.delete('/:id/emergency-contacts/:contactId', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const result = await prisma.emergencyContact.deleteMany({
      where: { id: req.params.contactId, employeeId: req.params.id, orgId: req.orgId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Contact deleted' });
  } catch (err) { next(err); }
});

// ── Employee Documents ──────────────────────────────────────────────────────

// GET /api/v1/employees/:id/documents
router.get('/:id/documents', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: req.params.id, orgId: req.orgId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, name: true, type: true, fileSize: true, mimeType: true, uploadedAt: true },
    });
    res.json({ documents });
  } catch (err) { next(err); }
});

// POST /api/v1/employees/:id/documents — Upload document
router.post('/:id/documents', requireRole('org_admin', 'hr_manager'), docUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const doc = await prisma.employeeDocument.create({
      data: {
        orgId: req.orgId,
        employeeId: req.params.id,
        name,
        type,
        filePath: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
    res.status(201).json({ document: { id: doc.id, name: doc.name, type: doc.type, fileSize: doc.fileSize, mimeType: doc.mimeType, uploadedAt: doc.uploadedAt }, message: 'Document uploaded' });
  } catch (err) { next(err); }
});

// GET /api/v1/employees/:id/documents/:docId/download — Download document
router.get('/:id/documents/:docId/download', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: req.params.docId, employeeId: req.params.id, orgId: req.orgId },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(docDir, doc.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, doc.name + path.extname(doc.filePath));
  } catch (err) { next(err); }
});

// DELETE /api/v1/employees/:id/documents/:docId
router.delete('/:id/documents/:docId', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: req.params.docId, employeeId: req.params.id, orgId: req.orgId },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete file from disk
    const filePath = path.join(docDir, doc.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.employeeDocument.delete({ where: { id: doc.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
