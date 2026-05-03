// ─────────────────────────────────────────────────────────────────────────────
// Geofencing Service — Branch location validation for mobile check-ins
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

/**
 * Haversine distance between two lat/lng points in meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Update geofence settings for a branch.
 */
async function updateBranchGeofence({ orgId, branchId, latitude, longitude, geofenceRadius, geofenceEnabled, adminId, req }) {
  const prisma = getPrisma();

  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw Object.assign(new Error('Branch not found'), { status: 404 });

  const data = {};
  if (latitude !== undefined) data.latitude = latitude;
  if (longitude !== undefined) data.longitude = longitude;
  if (geofenceRadius !== undefined) data.geofenceRadius = geofenceRadius;
  if (geofenceEnabled !== undefined) data.geofenceEnabled = geofenceEnabled;

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data,
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'branch.geofence_update',
    resource: 'branch',
    resourceId: branchId,
    oldData: { latitude: branch.latitude, longitude: branch.longitude, geofenceRadius: branch.geofenceRadius, geofenceEnabled: branch.geofenceEnabled },
    newData: data,
    req,
  });

  return updated;
}

/**
 * Get branch geofence configuration.
 */
async function getBranchGeofence({ orgId, branchId }) {
  const prisma = getPrisma();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, orgId },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
      geofenceEnabled: true,
      address: true,
      city: true,
    },
  });

  if (!branch) throw Object.assign(new Error('Branch not found'), { status: 404 });
  return branch;
}

/**
 * Validate that an employee's location is within their assigned branch geofence.
 *
 * Returns:
 *   { allowed: true, distance, radius } — within fence
 *   { allowed: false, distance, radius, error } — outside fence
 *   { allowed: true, geofenceDisabled: true } — geofencing not enabled
 */
async function validateLocation({ orgId, employeeId, latitude, longitude }) {
  const prisma = getPrisma();

  if (!latitude || !longitude) {
    return { allowed: true, geofenceDisabled: true, reason: 'no_location_provided' };
  }

  // Get employee's current branch via assignment
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isCurrent: true },
    include: {
      branch: {
        select: { id: true, name: true, latitude: true, longitude: true, geofenceRadius: true, geofenceEnabled: true },
      },
    },
  });

  if (!assignment?.branch) {
    return { allowed: true, geofenceDisabled: true, reason: 'no_branch_assigned' };
  }

  const branch = assignment.branch;

  if (!branch.geofenceEnabled) {
    return { allowed: true, geofenceDisabled: true, reason: 'geofence_not_enabled' };
  }

  if (!branch.latitude || !branch.longitude || !branch.geofenceRadius) {
    return { allowed: true, geofenceDisabled: true, reason: 'geofence_not_configured' };
  }

  const distance = haversineDistance(
    Number(latitude), Number(longitude),
    Number(branch.latitude), Number(branch.longitude)
  );

  const radius = branch.geofenceRadius;
  const allowed = distance <= radius;

  return {
    allowed,
    distance: Math.round(distance),
    radius,
    branchName: branch.name,
    ...(allowed ? {} : { error: `You are ${Math.round(distance - radius)}m outside the allowed zone (${branch.name})` }),
  };
}

/**
 * List all branch geofences for an org (admin map view).
 */
async function listGeofences({ orgId }) {
  const prisma = getPrisma();

  return prisma.branch.findMany({
    where: { orgId, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      city: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
      geofenceEnabled: true,
    },
    orderBy: { name: 'asc' },
  });
}

module.exports = {
  haversineDistance,
  updateBranchGeofence,
  getBranchGeofence,
  validateLocation,
  listGeofences,
};
