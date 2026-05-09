// ─────────────────────────────────────────────────────────────────────────────
// HRM Module Index — Incentives, Bonuses, Referrals, Tasks, Projects
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'hrm',
  routes: {
    incentives: require('../../routes/v1/incentives'),
    bonuses: require('../../routes/v1/bonuses'),
    referrals: require('../../routes/v1/referrals'),
    tasks: require('../../routes/v1/tasks'),
    projects: require('../../routes/v1/projects'),
  },
  service: {
    incentive: require('../../services/incentive.service'),
    bonus: require('../../services/bonus.service'),
    referral: require('../../services/referral.service'),
    task: require('../../services/task.service'),
    project: require('../../services/project.service'),
  },
  moduleCodes: {
    incentives: 'incentive',
    bonuses: 'bonus',
    referrals: 'referral',
    tasks: 'task',
    projects: 'project',
  },
};
