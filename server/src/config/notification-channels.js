// ─────────────────────────────────────────────────────────────────────────────
// Notification Channels — Maps NotificationType → NotificationChannel
//
// Each NotificationType is assigned to a channel that admins and users
// can independently enable/disable for push and email.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map of NotificationType → NotificationChannel
 */
const TYPE_TO_CHANNEL = {
  // Leave-related
  LEAVE:              'LEAVE_UPDATES',

  // Attendance-related
  CHECKOUT_REMINDER:  'ATTENDANCE',
  ATTENDANCE_ANOMALY: 'ATTENDANCE',

  // Notices
  NOTICE:             'NOTICES',

  // System / infra
  SYSTEM:             'SYSTEM',
  BACKUP_ERROR:       'SYSTEM',
  CONTRACT_EXPIRY:    'SYSTEM',

  // People / social
  BIRTHDAY:           'BIRTHDAYS',
  ANNIVERSARY:        'BIRTHDAYS',

  // Payroll
  PAYROLL_READY:      'PAYROLL',
  PAYROLL_ERROR:      'PAYROLL',

  // Reports
  REPORT_READY:       'REPORTS',

  // CRM
  CRM_ACTIVITY_REMINDER: 'CRM',
};

/**
 * Channel metadata — labels and descriptions for UI
 */
const CHANNELS = {
  LEAVE_UPDATES: {
    label: 'Leave Updates',
    description: 'Leave applications, approvals, and rejections',
    icon: 'calendar-outline',
    androidChannelId: 'leave-updates',
  },
  ATTENDANCE: {
    label: 'Attendance',
    description: 'Check-out reminders and attendance anomalies',
    icon: 'time-outline',
    androidChannelId: 'attendance',
  },
  NOTICES: {
    label: 'Notices',
    description: 'Company announcements and notices',
    icon: 'megaphone-outline',
    androidChannelId: 'notices',
  },
  SYSTEM: {
    label: 'System',
    description: 'System alerts, backups, and contract expiry',
    icon: 'settings-outline',
    androidChannelId: 'system',
  },
  BIRTHDAYS: {
    label: 'Birthdays & Anniversaries',
    description: 'Employee birthday and work anniversary wishes',
    icon: 'gift-outline',
    androidChannelId: 'birthdays',
  },
  PAYROLL: {
    label: 'Payroll',
    description: 'Payslip ready and payroll error alerts',
    icon: 'wallet-outline',
    androidChannelId: 'payroll',
  },
  REPORTS: {
    label: 'Reports',
    description: 'Generated report notifications',
    icon: 'document-text-outline',
    androidChannelId: 'reports',
  },
  CRM: {
    label: 'CRM',
    description: 'CRM activity reminders and follow-ups',
    icon: 'people-outline',
    androidChannelId: 'crm',
  },
};

/**
 * Get the channel for a given notification type
 */
function getChannelForType(notificationType) {
  return TYPE_TO_CHANNEL[notificationType] || 'SYSTEM';
}

/**
 * Get all channel names
 */
function getAllChannels() {
  return Object.keys(CHANNELS);
}

module.exports = {
  TYPE_TO_CHANNEL,
  CHANNELS,
  getChannelForType,
  getAllChannels,
};
