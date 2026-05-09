// ─────────────────────────────────────────────────────────────────────────────
// Referral Service — Employee referral tracking
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

async function listReferrals({ orgId, status, referrerId }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (referrerId) where.referrerId = referrerId;
  return prisma.referral.findMany({
    where,
    include: {
      referrer: { select: { id: true, name: true, department: true } },
      hiredEmployee: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getMyReferrals({ orgId, userId }) {
  const prisma = getPrisma();
  return prisma.referral.findMany({
    where: { orgId, referrerId: userId },
    include: {
      hiredEmployee: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createReferral({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.referral.create({
    data: {
      orgId,
      referrerId: userId,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail || null,
      candidatePhone: data.candidatePhone || null,
      position: data.position,
      department: data.department || null,
      notes: data.notes || null,
    },
  });
}

async function updateReferral({ orgId, id, data }) {
  const prisma = getPrisma();
  const updateData = {};
  if (data.status) updateData.status = data.status;
  if (data.candidateName) updateData.candidateName = data.candidateName;
  if (data.candidateEmail !== undefined) updateData.candidateEmail = data.candidateEmail;
  if (data.candidatePhone !== undefined) updateData.candidatePhone = data.candidatePhone;
  if (data.position) updateData.position = data.position;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.hiredEmployeeId !== undefined) updateData.hiredEmployeeId = data.hiredEmployeeId;
  if (data.bonusAmount !== undefined) updateData.bonusAmount = data.bonusAmount;

  if (data.status === 'HIRED' && data.bonusAmount) {
    updateData.bonusPaidAt = null; // will be marked when paid via incentive
  }

  return prisma.referral.update({ where: { id }, data: updateData });
}

async function deleteReferral({ orgId, id }) {
  const prisma = getPrisma();
  return prisma.referral.delete({ where: { id } });
}

// ── Referral Stats (for incentive calculator) ────────────────────────────────

async function getReferralStats({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const hired = await prisma.referral.count({
    where: {
      orgId,
      referrerId: employeeId,
      status: 'HIRED',
      updatedAt: { gte: startDate, lte: endDate },
    },
  });

  const total = await prisma.referral.count({
    where: {
      orgId,
      referrerId: employeeId,
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  return { hiredCount: hired, totalSubmitted: total };
}

module.exports = {
  listReferrals, getMyReferrals, createReferral, updateReferral, deleteReferral,
  getReferralStats,
};
