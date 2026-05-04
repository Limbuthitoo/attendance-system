// Barrel re-export — keeps `import { api } from '../api'` working.
// New code can import from domain modules directly:
//   import { attendance } from '../api/attendance'

import { auth } from './auth';
import { attendance } from './attendance';
import { leaves } from './leaves';
import { employees, dashboard } from './employees';
import { holidays, notices, notifications } from './content';
import { settings, qr, geofence, reports, overtime } from './settings';

export const api = {
  ...auth,
  ...attendance,
  ...leaves,
  ...employees,
  ...dashboard,
  ...holidays,
  ...notices,
  ...notifications,
  ...settings,
  ...qr,
  ...geofence,
  ...reports,
  ...overtime,
};
