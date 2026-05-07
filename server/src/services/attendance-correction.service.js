// ─────────────────────────────────────────────────────────────────────────────
// Attendance Correction Service — Regularization workflow
// Employee requests correction → Manager/Admin approves → Record updated
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

/**
 * Employee requests attendance correction (regularization).
 */
async function requestCorrection({ orgId, employeeId, date, correctionType, requestedCheckIn, requestedCheckOut, reason, req }) {
  const prisma = getPrisma();

  if (!reason || !correctionType) {
    throw Object.assign(new Error('Correction type and reason are required'), { status: 400 });
  }

  // Find existing attendance record for that date
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: new Date(date) } },
  });

  if (existing?.isLocked) {
    throw Object.assign(new Error('Cannot request correction for locked attendance'), { status: 403 });
  }

  // Check for duplicate pending request
  const pendingRequest = await prisma.attendanceCorrection.findFirst({
    where: { employeeId, date: new Date(date), status: 'PENDING' },
  });

  if (pendingRequest) {
    throw Object.assign(new Error('A correction request for this date is already pending'), { status: 400 });
  }

  const correction = await prisma.attendanceCorrection.create({
    data: {
      orgId,
      employeeId,
      attendanceId: existing?.id || null,
      date: new Date(date),
      correctionType,
      requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
      requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
      reason,
    },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'attendance.correction_request',
    resource: 'attendance_correction',
    resourceId: correction.id,
    newData: { date, correctionType, reason },
    req,
  });

  return correction;
}

/**
 * Manager/Admin reviews correction request.
 */
async function reviewCorrection({ correctionId, reviewerId, orgId, status, reviewNote, req }) {
  const prisma = getPrisma();

  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id: correctionId, orgId },
  });

  if (!correction) {
    throw Object.assign(new Error('Correction request not found'), { status: 404 });
  }

  if (correction.status !== 'PENDING') {
    throw Object.assign(new Error('This request has already been reviewed'), { status: 400 });
  }

  // Update correction status
  const updated = await prisma.attendanceCorrection.update({
    where: { id: correctionId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewNote: reviewNote || null,
    },
  });

  // If approved, update the attendance record
  if (status === 'APPROVED') {
    const updateData = {};

    if (correction.requestedCheckIn) {
      updateData.checkIn = correction.requestedCheckIn;
    }
    if (correction.requestedCheckOut) {
      updateData.checkOut = correction.requestedCheckOut;
    }

    // Recalculate work hours if both check-in and check-out are available
    if (updateData.checkIn || updateData.checkOut) {
      const existingAtt = correction.attendanceId
        ? await prisma.attendance.findUnique({ where: { id: correction.attendanceId } })
        : null;

      const finalCheckIn = updateData.checkIn || existingAtt?.checkIn;
      const finalCheckOut = updateData.checkOut || existingAtt?.checkOut;

      if (finalCheckIn && finalCheckOut) {
        const workHours = (new Date(finalCheckOut).getTime() - new Date(finalCheckIn).getTime()) / (1000 * 60 * 60);
        updateData.workHours = Math.round(Math.max(0, workHours) * 100) / 100;
        updateData.status = 'PRESENT'; // Reset status since it's been corrected
      }

      updateData.notes = `[CORRECTED] Approved by manager. ${reviewNote || ''}`.trim();

      if (correction.attendanceId) {
        await prisma.attendance.update({
          where: { id: correction.attendanceId },
          data: updateData,
        });
      } else {
        // Create new attendance record if none existed
        await prisma.attendance.create({
          data: {
            orgId,
            employeeId: correction.employeeId,
            date: correction.date,
            checkIn: updateData.checkIn || null,
            checkOut: updateData.checkOut || null,
            workHours: updateData.workHours || 0,
            status: updateData.status || 'PRESENT',
            source: 'SYSTEM',
            notes: updateData.notes,
          },
        });
      }
    }
  }

  await auditLog({
    orgId,
    actorId: reviewerId,
    action: `attendance.correction_${status.toLowerCase()}`,
    resource: 'attendance_correction',
    resourceId: correctionId,
    newData: { status, reviewNote },
    req,
  });

  return updated;
}

/**
 * Get correction requests for an org (admin/manager view).
 */
async function getOrgCorrections({ orgId, status, page = 1, limit = 20 }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (status) where.status = status;

  const [corrections, total] = await Promise.all([
    prisma.attendanceCorrection.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, department: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.attendanceCorrection.count({ where }),
  ]);

  return { corrections, total, page, limit };
}

/**
 * Get correction requests for an employee (self view).
 */
async function getMyCorrections({ employeeId, orgId }) {
  const prisma = getPrisma();

  return prisma.attendanceCorrection.findMany({
    where: { employeeId, orgId },
    include: {
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  requestCorrection,
  reviewCorrection,
  getOrgCorrections,
  getMyCorrections,
};
