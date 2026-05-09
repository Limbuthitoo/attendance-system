// Re-export the unified api object for backward compatibility.
// New code should import from specific domain modules instead:
//   import { attendance } from './lib/api/attendance'

import { request } from './client';
import { auth } from './auth';
import { attendance } from './attendance';
import { leaves } from './leaves';
import { employees, departments, designations } from './employees';
import { dashboard } from './dashboard';
import { devices, nfc } from './devices';
import { holidays, notices, notifications, policies } from './content';
import { branches, shifts, workSchedules, assignments } from './settings';
import { reports, overtime, geofence, payroll } from './reports';
import { incentives } from './incentives';
import { crm } from './crm';
import { performance } from './performance';
import { tasks } from './tasks';
import { projects } from './projects';
import { referrals } from './referrals';
import { bonuses } from './bonuses';
import { accounting } from './accounting';
import { billing } from './billing';
import { taxConfig, festivalAdvances, compensation } from './compensation';
import { recruitment, onboarding, separation } from './recruitment';
import { training } from './training';
import { ess, orgChart } from './ess';

export const api = {
  _request: (endpoint, options) => request(endpoint, options),
  ...auth,
  ...attendance,
  ...leaves,
  ...employees,
  ...departments,
  ...designations,
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
  ...incentives,
  ...crm,
  ...performance,
  ...tasks,
  ...projects,
  ...referrals,
  ...bonuses,
  ...accounting,
  ...billing,
  ...taxConfig,
  ...festivalAdvances,
  ...compensation,
  ...recruitment,
  ...onboarding,
  ...separation,
  ...training,
  ...ess,
  ...orgChart,
};
