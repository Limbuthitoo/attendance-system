// Re-export the unified api object for backward compatibility.
// New code should import from specific domain modules instead:
//   import { attendance } from './lib/api/attendance'

import { request } from './client';
import { auth } from './auth';
import { attendance } from './attendance';
import { leaves } from './leaves';
import { employees } from './employees';
import { dashboard } from './dashboard';
import { devices, nfc } from './devices';
import { holidays, notices, notifications, policies } from './content';
import { branches, shifts, workSchedules, assignments } from './settings';
import { reports, overtime, geofence, payroll } from './reports';

export const api = {
  _request: (endpoint, options) => request(endpoint, options),
  ...auth,
  ...attendance,
  ...leaves,
  ...employees,
  ...dashboard,
  ...nfc,
  ...devices,
  ...holidays,
  ...notices,
  ...notifications,
  ...branches,
  ...shifts,
  ...workSchedules,
  ...assignments,
  ...reports,
  ...overtime,
  ...geofence,
  ...payroll,
  ...policies,
};
