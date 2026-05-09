import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Trophy, Calculator, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Filter, DollarSign, Users, TrendingUp,
  AlertTriangle, Edit2, Play, Building2, Target, CheckSquare,
  FolderKanban, UserPlus, Briefcase, Palette, Megaphone, Code2, Copy
} from 'lucide-react';
import { api } from '../lib/api';

const INCENTIVE_TYPES = ['ATTENDANCE', 'PERFORMANCE', 'SALES', 'TASK', 'PROJECT', 'REFERRAL', 'FESTIVAL', 'CUSTOM'];
const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
const INCENTIVE_STATUSES = ['CALCULATED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID'];

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
  CALCULATED: 'bg-blue-100 text-blue-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  PAID: 'bg-purple-100 text-purple-700',
};

const TYPE_ICONS = {
  ATTENDANCE: Clock,
  PERFORMANCE: TrendingUp,
  SALES: DollarSign,
  TASK: CheckSquare,
  PROJECT: FolderKanban,
  REFERRAL: UserPlus,
  FESTIVAL: Trophy,
  CUSTOM: Trophy,
};

const DEPT_ICONS = {
  Sales: Target,
  'Business Development': Briefcase,
  Creative: Palette,
  Marketing: Megaphone,
  'Software Development': Code2,
};

// ── Department-specific plan templates ──────────────────────────────────────
const DEPT_TEMPLATES = {
  Sales: [
    { name: 'Sales Commission', type: 'SALES', description: 'Commission on won deals', rules: [{ condition: 'commission_pct', percentage: 5 }, { condition: 'target_bonus', target: 500000, amount: 10000 }] },
    { name: 'Sales Attendance Bonus', type: 'ATTENDANCE', description: 'Attendance incentive for sales team', rules: [{ condition: 'zero_absence', amount: 3000 }, { condition: 'punctuality', minPunctualityPct: 90, amount: 2000 }] },
    { name: 'Sales KPI Bonus', type: 'PERFORMANCE', description: 'Performance-based bonus for sales targets', rules: [{ condition: 'score_threshold', minScore: 80, amount: 15000 }, { condition: 'score_multiplier', multiplier: 100 }] },
  ],
  'Business Development': [
    { name: 'Client Acquisition Bonus', type: 'SALES', description: 'Bonus per new deal closed', rules: [{ condition: 'per_deal', amount: 5000 }, { condition: 'commission_pct', percentage: 3 }] },
    { name: 'BD Performance Bonus', type: 'PERFORMANCE', description: 'KPI-based incentive for BD team', rules: [{ condition: 'score_threshold', minScore: 75, amount: 10000 }] },
    { name: 'Referral Bonus', type: 'REFERRAL', description: 'Bonus for successful hires from referrals', rules: [{ condition: 'per_hire', amount: 15000 }] },
  ],
  Creative: [
    { name: 'Creative Task Bonus', type: 'TASK', description: 'Per-task incentive for design deliverables', rules: [{ condition: 'per_task', amount: 500 }, { condition: 'completion_bonus', minTasks: 15, amount: 5000 }] },
    { name: 'Creative Project Bonus', type: 'PROJECT', description: 'Bonus for completed creative projects', rules: [{ condition: 'per_project_completed', amount: 8000 }] },
    { name: 'Creative Performance Bonus', type: 'PERFORMANCE', description: 'KPI-based incentive for creative quality', rules: [{ condition: 'score_threshold', minScore: 80, amount: 10000 }] },
  ],
  Marketing: [
    { name: 'Campaign Task Bonus', type: 'TASK', description: 'Incentive for marketing task completion', rules: [{ condition: 'per_task', amount: 400 }, { condition: 'completion_bonus', minTasks: 20, amount: 5000 }] },
    { name: 'Marketing KPI Bonus', type: 'PERFORMANCE', description: 'Performance-based bonus for campaign KPIs', rules: [{ condition: 'score_threshold', minScore: 70, amount: 8000 }, { condition: 'score_multiplier', multiplier: 80 }] },
    { name: 'Marketing Project Milestone', type: 'PROJECT', description: 'Bonus for completed marketing campaigns', rules: [{ condition: 'per_project_completed', amount: 6000 }, { condition: 'active_member_bonus', amount: 2000 }] },
  ],
  'Software Development': [
    { name: 'Dev Task Completion Bonus', type: 'TASK', description: 'Per-task incentive for dev tasks', rules: [{ condition: 'per_task', amount: 300 }, { condition: 'completion_bonus', minTasks: 20, amount: 8000 }] },
    { name: 'Sprint Project Bonus', type: 'PROJECT', description: 'Bonus for delivered software projects', rules: [{ condition: 'per_project_completed', amount: 10000 }, { condition: 'active_member_bonus', amount: 3000 }] },
    { name: 'Dev Performance Bonus', type: 'PERFORMANCE', description: 'KPI-based incentive for code quality & velocity', rules: [{ condition: 'score_threshold', minScore: 80, amount: 12000 }] },
    { name: 'Dev Referral Bonus', type: 'REFERRAL', description: 'Bonus for referring engineers', rules: [{ condition: 'per_hire', amount: 20000 }] },
  ],
};

const ALL_DEPARTMENTS = Object.keys(DEPT_TEMPLATES);

export default function Incentives() {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [incentives, setIncentives] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [filterDept, setFilterDept] = useState('');

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterStatus, setFilterStatus] = useState('');

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.getPlans();
      setPlans(res.plans);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadIncentives = useCallback(async () => {
    try {
      const params = { year: filterYear, month: filterMonth };
      if (filterStatus) params.status = filterStatus;
      const res = await api.listIncentives(params);
      setIncentives(res.records);
    } catch (err) {
      console.error(err);
    }
  }, [filterYear, filterMonth, filterStatus]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.getSummary({ year: filterYear, month: filterMonth });
      setSummary(res);
    } catch (err) {
      console.error(err);
    }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPlans(), loadIncentives(), loadSummary()])
      .finally(() => setLoading(false));
  }, [loadPlans, loadIncentives, loadSummary]);

  const tabs = [
    { key: 'plans', label: 'Plans', icon: Trophy },
    { key: 'records', label: 'Incentive Records', icon: DollarSign },
    { key: 'summary', label: 'Summary', icon: TrendingUp },
    { key: 'templates', label: 'Dept Templates', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incentive Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage incentive plans, calculate rewards, and track payouts</p>
        </div>
        {/* Department filter */}
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-gray-400" />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">All Departments</option>
            {ALL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {tab === 'plans' && (
            <PlansTab plans={plans} filterDept={filterDept} onRefresh={() => { loadPlans(); loadIncentives(); loadSummary(); }}
              showForm={showPlanForm} setShowForm={setShowPlanForm} editPlan={editPlan} setEditPlan={setEditPlan} />
          )}
          {tab === 'records' && (
            <RecordsTab
              incentives={incentives} filterDept={filterDept}
              filterYear={filterYear} setFilterYear={setFilterYear}
              filterMonth={filterMonth} setFilterMonth={setFilterMonth}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              onRefresh={() => { loadIncentives(); loadSummary(); }}
            />
          )}
          {tab === 'summary' && (
            <SummaryTab summary={summary} year={filterYear} month={filterMonth} />
          )}
          {tab === 'templates' && (
            <TemplatesTab onApply={(template) => { setShowPlanForm(true); setEditPlan(template); setTab('plans'); }} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Plans Tab ──────────────────────────────────────────────────────────────

function PlansTab({ plans, filterDept, onRefresh, showForm, setShowForm, editPlan, setEditPlan }) {
  const emptyForm = {
    name: '', type: 'ATTENDANCE', description: '',
    calculationFrequency: 'monthly', approvalRequired: true, taxable: true,
    maxCap: '', startDate: new Date().toISOString().split('T')[0],
    applicableDepartments: [], allowProbation: false, minWorkingDays: 0,
    rules: [{ condition: 'zero_absence', amount: 5000 }],
  };

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [calcModal, setCalcModal] = useState(null);

  // Pre-fill form when editPlan is set (from template or edit button)
  useEffect(() => {
    if (editPlan) {
      setForm({
        ...emptyForm,
        ...editPlan,
        maxCap: editPlan.maxCap || '',
        startDate: editPlan.startDate ? new Date(editPlan.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        endDate: editPlan.endDate ? new Date(editPlan.endDate).toISOString().split('T')[0] : '',
        applicableDepartments: editPlan.applicableDepartments || [],
        rules: editPlan.rules || [],
      });
    }
  }, [editPlan]);

  function resetForm() {
    setForm(emptyForm);
    setEditPlan(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = { ...form, maxCap: form.maxCap ? Number(form.maxCap) : null };
      if (editPlan?.id) {
        await api.updatePlan(editPlan.id, data);
      } else {
        await api.createPlan(data);
      }
      resetForm();
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(plan) {
    setEditPlan(plan);
    setShowForm(true);
  }

  async function handleStatusChange(planId, newStatus) {
    try { await api.updatePlan(planId, { status: newStatus }); onRefresh(); } catch (err) { alert(err.message); }
  }

  // Filter plans by department
  const filteredPlans = filterDept
    ? plans.filter(p => p.applicableDepartments?.includes(filterDept) || p.applicableDepartments?.length === 0)
    : plans;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{filteredPlans.length} incentive plans{filterDept ? ` for ${filterDept}` : ''}</p>
        <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Create Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">{editPlan?.id ? 'Edit Plan' : 'Create Incentive Plan'}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Sales Commission Q2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, rules: getDefaultRules(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {INCENTIVE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Cap (NPR)</label>
              <input value={form.maxCap} onChange={e => setForm({ ...form, maxCap: e.target.value })} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select value={form.calculationFrequency} onChange={e => setForm({ ...form, calculationFrequency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Working Days</label>
              <input type="number" value={form.minWorkingDays} onChange={e => setForm({ ...form, minWorkingDays: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Department selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Applicable Departments</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DEPARTMENTS.map(dept => {
                const active = form.applicableDepartments.includes(dept);
                const Icon = DEPT_ICONS[dept] || Building2;
                return (
                  <button key={dept} type="button" onClick={() => {
                    setForm({ ...form, applicableDepartments: active
                      ? form.applicableDepartments.filter(d => d !== dept)
                      : [...form.applicableDepartments, dept] });
                  }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <Icon size={14} /> {dept}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave empty to apply to all departments</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Plan description..." />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.approvalRequired} onChange={e => setForm({ ...form, approvalRequired: e.target.checked })} className="rounded" />
              Requires Approval
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} className="rounded" />
              Taxable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowProbation} onChange={e => setForm({ ...form, allowProbation: e.target.checked })} className="rounded" />
              Allow Probation
            </label>
          </div>

          {/* Type-specific rules editor */}
          <TypeRulesEditor type={form.type} rules={form.rules} onChange={rules => setForm({ ...form, rules })} />

          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {submitting ? 'Saving...' : editPlan?.id ? 'Update Plan' : 'Create Plan'}
            </button>
            {editPlan?.id && <button type="button" onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">Cancel Edit</button>}
          </div>
        </form>
      )}

      {/* Calculate modal */}
      {calcModal && <CalculateModal planId={calcModal} onClose={() => setCalcModal(null)} onDone={() => { setCalcModal(null); onRefresh(); }} />}

      {/* Plans list */}
      <div className="space-y-3">
        {filteredPlans.map(plan => {
          const Icon = TYPE_ICONS[plan.type] || Trophy;
          const depts = plan.applicableDepartments || [];
          return (
            <div key={plan.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Icon size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500">{plan.type} · {plan.calculationFrequency} · {plan._count?.employeeIncentives || 0} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plan.status]}`}>
                    {plan.status}
                  </span>
                  <button onClick={() => handleEdit(plan)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  {plan.status === 'ACTIVE' && (
                    <button onClick={() => setCalcModal(plan.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100">
                      <Calculator size={14} /> Calculate
                    </button>
                  )}
                  {plan.status === 'DRAFT' && (
                    <button onClick={() => handleStatusChange(plan.id, 'ACTIVE')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100">
                      Activate
                    </button>
                  )}
                  {plan.status === 'ACTIVE' && (
                    <button onClick={() => handleStatusChange(plan.id, 'PAUSED')} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100">
                      Pause
                    </button>
                  )}
                  {plan.status === 'PAUSED' && (
                    <button onClick={() => handleStatusChange(plan.id, 'ACTIVE')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100">
                      Resume
                    </button>
                  )}
                </div>
              </div>
              {plan.description && <p className="text-sm text-gray-600 mt-2 ml-13">{plan.description}</p>}
              {depts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-13">
                  {depts.map(d => {
                    const DIcon = DEPT_ICONS[d] || Building2;
                    return <span key={d} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"><DIcon size={10} /> {d}</span>;
                  })}
                </div>
              )}
              {depts.length === 0 && <p className="text-xs text-gray-400 mt-1 ml-13">All departments</p>}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Starts: {new Date(plan.startDate).toLocaleDateString()}</span>
                {plan.endDate && <span>Ends: {new Date(plan.endDate).toLocaleDateString()}</span>}
                {plan.maxCap && <span>Max Cap: NPR {Number(plan.maxCap).toLocaleString()}</span>}
                {plan.approvalRequired && <span className="text-amber-600">Requires approval</span>}
                {Array.isArray(plan.rules) && plan.rules.length > 0 && (
                  <span className="text-blue-500">{plan.rules.length} rule{plan.rules.length > 1 ? 's' : ''} configured</span>
                )}
              </div>
            </div>
          );
        })}

        {plans.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <Trophy size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No incentive plans yet</p>
            <p className="text-gray-400 text-xs mt-1">Create your first plan to start rewarding employees</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Default rules per type ─────────────────────────────────────────────────

function getDefaultRules(type) {
  switch (type) {
    case 'ATTENDANCE': return [{ condition: 'zero_absence', amount: 5000 }];
    case 'SALES': return [{ condition: 'commission_pct', percentage: 5 }];
    case 'PERFORMANCE': return [{ condition: 'score_threshold', minScore: 80, amount: 10000 }];
    case 'TASK': return [{ condition: 'per_task', amount: 500 }];
    case 'PROJECT': return [{ condition: 'per_project_completed', amount: 8000 }];
    case 'REFERRAL': return [{ condition: 'per_hire', amount: 15000 }];
    case 'FESTIVAL': case 'CUSTOM': return [{ condition: 'fixed_amount', amount: 5000 }];
    default: return [];
  }
}

// ─── Unified Rules Editor for all types ─────────────────────────────────────

const TYPE_CONDITIONS = {
  ATTENDANCE: [
    { value: 'zero_absence', label: 'Zero Absence', fields: ['amount'] },
    { value: 'punctuality', label: 'Punctuality (≥ X% on-time)', fields: ['minPunctualityPct', 'amount'] },
    { value: 'no_late', label: 'No Late (≤ N late days)', fields: ['maxLateCount', 'amount'] },
    { value: 'full_attendance', label: 'Full Attendance (zero late, absent, early-exit)', fields: ['amount'] },
  ],
  SALES: [
    { value: 'per_deal', label: 'Per Deal Won', fields: ['amount'], desc: 'Fixed amount per deal closed' },
    { value: 'commission_pct', label: 'Commission %', fields: ['percentage'], desc: 'Percentage of deal value' },
    { value: 'target_bonus', label: 'Target Bonus', fields: ['target', 'amount'], desc: 'Bonus if total sales ≥ target' },
    { value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] },
  ],
  PERFORMANCE: [
    { value: 'score_threshold', label: 'Score Threshold', fields: ['minScore', 'amount'], desc: 'Bonus if avg KPI score ≥ min' },
    { value: 'score_multiplier', label: 'Score Multiplier', fields: ['multiplier'], desc: 'score × multiplier = incentive' },
    { value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] },
  ],
  TASK: [
    { value: 'per_task', label: 'Per Task Completed', fields: ['amount'], desc: 'Fixed amount per task done' },
    { value: 'completion_bonus', label: 'Completion Bonus', fields: ['minTasks', 'amount'], desc: 'Bonus if ≥ N tasks completed' },
    { value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] },
  ],
  PROJECT: [
    { value: 'per_project_completed', label: 'Per Project Completed', fields: ['amount'], desc: 'Fixed amount per project delivered' },
    { value: 'active_member_bonus', label: 'Active Member Bonus', fields: ['amount'], desc: 'Bonus for being on an active project' },
    { value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] },
  ],
  REFERRAL: [
    { value: 'per_hire', label: 'Per Hire', fields: ['amount'], desc: 'Bonus per referred candidate hired' },
    { value: 'per_submission', label: 'Per Submission', fields: ['amount'], desc: 'Small bonus per referral submitted' },
    { value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] },
  ],
  FESTIVAL: [{ value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] }],
  CUSTOM: [{ value: 'fixed_amount', label: 'Fixed Amount', fields: ['amount'] }],
};

const FIELD_LABELS = {
  amount: { label: 'Amount (NPR)', type: 'number', placeholder: '5000' },
  percentage: { label: 'Percentage (%)', type: 'number', placeholder: '5', step: '0.1' },
  minPunctualityPct: { label: 'Min %', type: 'number', placeholder: '95' },
  maxLateCount: { label: 'Max Late Days', type: 'number', placeholder: '0' },
  minScore: { label: 'Min Score', type: 'number', placeholder: '80' },
  multiplier: { label: 'Multiplier', type: 'number', placeholder: '100', step: '0.1' },
  target: { label: 'Target (NPR)', type: 'number', placeholder: '500000' },
  minTasks: { label: 'Min Tasks', type: 'number', placeholder: '10' },
};

function TypeRulesEditor({ type, rules, onChange }) {
  const conditions = TYPE_CONDITIONS[type] || [];
  if (conditions.length === 0) return null;

  function addRule() {
    const first = conditions[0];
    const newRule = { condition: first.value };
    first.fields.forEach(f => { newRule[f] = f === 'amount' ? 0 : f === 'percentage' ? 5 : f === 'minScore' ? 80 : 0; });
    onChange([...rules, newRule]);
  }

  function removeRule(idx) { onChange(rules.filter((_, i) => i !== idx)); }

  function updateRule(idx, field, value) {
    const updated = [...rules];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  }

  function changeCondition(idx, newCondition) {
    const cond = conditions.find(c => c.value === newCondition);
    const newRule = { condition: newCondition };
    if (cond) cond.fields.forEach(f => { newRule[f] = rules[idx]?.[f] || 0; });
    const updated = [...rules];
    updated[idx] = newRule;
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">{type.replace(/_/g, ' ')} Rules</label>
      {rules.map((rule, idx) => {
        const cond = conditions.find(c => c.value === rule.condition) || conditions[0];
        return (
          <div key={idx} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg flex-wrap">
            <select value={rule.condition} onChange={e => changeCondition(idx, e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[180px]">
              {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {cond.fields.map(field => {
              const meta = FIELD_LABELS[field] || { label: field, type: 'number' };
              return (
                <div key={field} className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{meta.label}:</span>
                  <input type={meta.type} step={meta.step} value={rule[field] || ''} onChange={e => updateRule(idx, field, Number(e.target.value))}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={meta.placeholder} />
                </div>
              );
            })}
            {cond.desc && <span className="text-xs text-gray-400 italic">{cond.desc}</span>}
            <button type="button" onClick={() => removeRule(idx)} className="ml-auto text-red-500 hover:text-red-700"><X size={16} /></button>
          </div>
        );
      })}
      <button type="button" onClick={addRule} className="text-xs text-blue-600 font-medium hover:text-blue-700">+ Add Rule</button>
    </div>
  );
}

// ─── Calculate Modal ────────────────────────────────────────────────────────

function CalculateModal({ planId, onClose, onDone }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleCalculate() {
    setLoading(true);
    try {
      const res = await api.calculate({ planId, year, month });
      setResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculate Incentives</h3>

        {!result ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCalculate} disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Play size={16} /> {loading ? 'Calculating...' : 'Run Calculation'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center mb-4">
              <p className="text-2xl font-bold text-emerald-700">{result.calculated}</p>
              <p className="text-sm text-emerald-600">incentives calculated for {result.planName}</p>
              <p className="text-xs text-gray-500 mt-1">{result.year}/{String(result.month).padStart(2, '0')}</p>
            </div>
            <div className="flex justify-end">
              <button onClick={onDone} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Records Tab ────────────────────────────────────────────────────────────

function RecordsTab({ incentives, filterDept, filterYear, setFilterYear, filterMonth, setFilterMonth, filterStatus, setFilterStatus, onRefresh }) {
  const [selected, setSelected] = useState([]);

  // Filter by department
  const filtered = filterDept
    ? incentives.filter(i => i.employee?.department === filterDept)
    : incentives;

  async function handleReview(id, action) {
    try {
      await api.review(id, { action });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBulkReview(action) {
    if (selected.length === 0) return;
    try {
      await api.bulkReview({ incentiveIds: selected, action });
      setSelected([]);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function toggleAll() {
    const reviewable = filtered.filter(i => ['CALCULATED', 'PENDING_REVIEW'].includes(i.status));
    if (selected.length === reviewable.length) {
      setSelected([]);
    } else {
      setSelected(reviewable.map(i => i.id));
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">All Statuses</option>
            {INCENTIVE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{selected.length} selected</span>
            <button onClick={() => handleBulkReview('approve')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
              <CheckCircle size={14} /> Approve All
            </button>
            <button onClick={() => handleBulkReview('reject')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
              <XCircle size={14} /> Reject All
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" onChange={toggleAll} checked={selected.length > 0 && selected.length === filtered.filter(i => ['CALCULATED', 'PENDING_REVIEW'].includes(i.status)).length} className="rounded" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Plan</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Calculated</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Approved</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {['CALCULATED', 'PENDING_REVIEW'].includes(inc.status) && (
                    <input type="checkbox" checked={selected.includes(inc.id)} onChange={() => toggleSelect(inc.id)} className="rounded" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{inc.employee?.name}</div>
                  <div className="text-xs text-gray-500">{inc.employee?.department}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{inc.plan?.name}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  NPR {Number(inc.calculatedAmount).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {inc.approvedAmount !== null ? `NPR ${Number(inc.approvedAmount).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inc.status]}`}>
                    {inc.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {['CALCULATED', 'PENDING_REVIEW'].includes(inc.status) && (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleReview(inc.id, 'approve')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Approve">
                        <CheckCircle size={16} />
                      </button>
                      <button onClick={() => handleReview(inc.id, 'reject')} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject">
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No incentive records for this period
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Tab ────────────────────────────────────────────────────────────

function SummaryTab({ summary, year, month }) {
  if (!summary) return <p className="text-gray-500 text-sm">Loading summary...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.totalRecords}</p>
          <p className="text-xs text-gray-500 mt-1">Total Records</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">NPR {summary.totalCalculated?.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Calculated</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">NPR {summary.totalApproved?.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Approved</p>
        </div>
        <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">NPR {summary.totalPaid?.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Paid</p>
        </div>
      </div>

      {summary.pendingApproval > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600" />
          <p className="text-sm text-amber-700 font-medium">{summary.pendingApproval} incentives pending approval</p>
        </div>
      )}

      {/* Status breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byStatus || {}).map(([status, count]) => (
            <span key={status} className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
              {status.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* By Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">By Plan</h3>
        <div className="space-y-2">
          {Object.entries(summary.byPlan || {}).map(([plan, data]) => (
            <div key={plan} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{plan}</span>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">NPR {data.total?.toLocaleString()}</span>
                <span className="text-xs text-gray-500 ml-2">({data.count} records)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Department Templates Tab ───────────────────────────────────────────────

function TemplatesTab({ onApply }) {
  const [expandedDept, setExpandedDept] = useState(null);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-1">Quick-Start Templates</h3>
        <p className="text-sm text-blue-700">Pre-configured incentive plans for each department. Click "Use Template" to create a plan with pre-filled rules. You can customize everything before saving.</p>
      </div>

      {ALL_DEPARTMENTS.map(dept => {
        const templates = DEPT_TEMPLATES[dept];
        const Icon = DEPT_ICONS[dept] || Building2;
        const isExpanded = expandedDept === dept;

        return (
          <div key={dept} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setExpandedDept(isExpanded ? null : dept)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon size={20} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{dept}</h3>
                  <p className="text-xs text-gray-500">{templates.length} template plans</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {templates.map((tmpl, idx) => {
                  const TIcon = TYPE_ICONS[tmpl.type] || Trophy;
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <TIcon size={16} className="text-gray-500" />
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">{tmpl.name}</h4>
                          <p className="text-xs text-gray-500">{tmpl.type} · {tmpl.description}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {tmpl.rules.map((r, ri) => (
                              <span key={ri} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                                {r.condition.replace(/_/g, ' ')}{r.amount ? `: NPR ${Number(r.amount).toLocaleString()}` : ''}{r.percentage ? `: ${r.percentage}%` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => onApply({ ...tmpl, applicableDepartments: [dept] })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0">
                        <Copy size={12} /> Use Template
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
