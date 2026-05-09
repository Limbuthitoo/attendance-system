import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Gift, Calculator, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Filter, DollarSign, Users, TrendingUp, AlertTriangle, Edit2, Building2,
  Target, Briefcase, Palette, Megaphone, Code2, Calendar, Award, Star, Play,
  CreditCard, Percent, Timer
} from 'lucide-react';
import { api } from '../lib/api';

const BONUS_TYPES = ['FESTIVAL', 'ANNUAL', 'QUARTERLY', 'RETENTION', 'SIGNING', 'SPOT', 'CUSTOM'];
const CALC_METHODS = ['fixed', 'salary_percentage', 'seniority_tiered', 'pro_rata'];

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  CALCULATING: 'bg-blue-100 text-blue-700',
  DISTRIBUTED: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
  CALCULATED: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAID: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const TYPE_ICONS = {
  FESTIVAL: Star, ANNUAL: Calendar, QUARTERLY: Timer,
  RETENTION: Award, SIGNING: CreditCard, SPOT: Gift, CUSTOM: Gift,
};

const DEPT_ICONS = {
  Sales: Target, 'Business Development': Briefcase, Creative: Palette,
  Marketing: Megaphone, 'Software Development': Code2,
};

const ALL_DEPARTMENTS = ['Sales', 'Business Development', 'Creative', 'Marketing', 'Software Development'];

const FESTIVAL_PRESETS = [
  { name: 'Dashain Bonus', festivalName: 'Dashain', baseAmount: 0, calculationMethod: 'salary_percentage', salaryPercentage: 100, description: 'One month basic salary as Dashain bonus' },
  { name: 'Tihar Bonus', festivalName: 'Tihar', baseAmount: 5000, calculationMethod: 'fixed', description: 'Fixed Tihar festival bonus' },
  { name: 'Holi Bonus', festivalName: 'Holi', baseAmount: 3000, calculationMethod: 'fixed', description: 'Holi festival bonus' },
];

export default function Bonuses() {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [filterDept, setFilterDept] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('');

  const loadPlans = useCallback(async () => {
    try { const res = await api.getBonusPlans({ fiscalYear }); setPlans(res.plans); } catch (err) { console.error(err); }
  }, [fiscalYear]);

  const loadRecords = useCallback(async () => {
    try {
      const params = { fiscalYear };
      if (filterStatus) params.status = filterStatus;
      const res = await api.getBonusRecords(params);
      setRecords(res.records);
    } catch (err) { console.error(err); }
  }, [fiscalYear, filterStatus]);

  const loadSummary = useCallback(async () => {
    try { const res = await api.getBonusSummary({ fiscalYear }); setSummary(res); } catch (err) { console.error(err); }
  }, [fiscalYear]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPlans(), loadRecords(), loadSummary()]).finally(() => setLoading(false));
  }, [loadPlans, loadRecords, loadSummary]);

  const refresh = () => { loadPlans(); loadRecords(); loadSummary(); };

  const tabs = [
    { key: 'plans', label: 'Bonus Plans', icon: Gift },
    { key: 'records', label: 'Bonus Records', icon: DollarSign },
    { key: 'summary', label: 'Summary', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonus Management</h1>
          <p className="text-sm text-gray-500 mt-1">Festival bonuses, annual bonuses, and employee rewards with eligibility criteria</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-gray-400" />
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="">All Departments</option>
              {ALL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={16} /> {t.label}
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
            <PlansTab plans={plans} filterDept={filterDept} onRefresh={refresh}
              showForm={showForm} setShowForm={setShowForm} editPlan={editPlan} setEditPlan={setEditPlan}
              fiscalYear={fiscalYear} />
          )}
          {tab === 'records' && (
            <RecordsTab records={records} filterDept={filterDept}
              fiscalYear={fiscalYear} filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              plans={plans} onRefresh={refresh} />
          )}
          {tab === 'summary' && <SummaryTab summary={summary} fiscalYear={fiscalYear} />}
        </>
      )}
    </div>
  );
}

// ─── Plans Tab ──────────────────────────────────────────────────────────────

function PlansTab({ plans, filterDept, onRefresh, showForm, setShowForm, editPlan, setEditPlan, fiscalYear }) {
  const emptyForm = {
    name: '', type: 'FESTIVAL', description: '', status: 'DRAFT',
    baseAmount: '', calculationMethod: 'fixed', salaryPercentage: '',
    seniorityTiers: [{ minYears: 0, maxYears: 2, multiplier: 0.5 }, { minYears: 2, maxYears: 5, multiplier: 1 }, { minYears: 5, maxYears: null, multiplier: 1.5 }],
    proRataEnabled: false,
    applicableDepartments: [], applicableDesignations: [],
    minServiceDays: 0, allowProbation: false,
    minAttendancePct: '', minPerformanceScore: '',
    requireNoUnpaidLeave: false, requireNoDisciplinary: false,
    fiscalYear: fiscalYear, bonusMonth: '', festivalName: '',
    maxCap: '', taxable: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [calcModal, setCalcModal] = useState(null);

  useEffect(() => {
    if (editPlan) {
      setForm({
        ...emptyForm,
        ...editPlan,
        baseAmount: editPlan.baseAmount || '',
        salaryPercentage: editPlan.salaryPercentage || '',
        minAttendancePct: editPlan.minAttendancePct || '',
        minPerformanceScore: editPlan.minPerformanceScore || '',
        maxCap: editPlan.maxCap || '',
        bonusMonth: editPlan.bonusMonth || '',
        seniorityTiers: editPlan.seniorityTiers || emptyForm.seniorityTiers,
        applicableDepartments: editPlan.applicableDepartments || [],
      });
    }
  }, [editPlan]);

  function resetForm() { setForm(emptyForm); setEditPlan(null); setShowForm(false); }

  function applyPreset(preset) {
    setForm({ ...form, ...preset });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        ...form,
        baseAmount: form.baseAmount ? Number(form.baseAmount) : 0,
        salaryPercentage: form.salaryPercentage ? Number(form.salaryPercentage) : null,
        minAttendancePct: form.minAttendancePct ? Number(form.minAttendancePct) : null,
        minPerformanceScore: form.minPerformanceScore ? Number(form.minPerformanceScore) : null,
        maxCap: form.maxCap ? Number(form.maxCap) : null,
        bonusMonth: form.bonusMonth ? Number(form.bonusMonth) : null,
        fiscalYear: form.fiscalYear ? Number(form.fiscalYear) : null,
      };
      if (editPlan?.id) {
        await api.updateBonusPlan(editPlan.id, data);
      } else {
        await api.createBonusPlan(data);
      }
      resetForm();
      onRefresh();
    } catch (err) { alert(err.message); } finally { setSubmitting(false); }
  }

  async function handleStatusChange(planId, newStatus) {
    try { await api.updateBonusPlan(planId, { status: newStatus }); onRefresh(); } catch (err) { alert(err.message); }
  }

  const filteredPlans = filterDept
    ? plans.filter(p => p.applicableDepartments?.includes(filterDept) || p.applicableDepartments?.length === 0)
    : plans;

  return (
    <div className="space-y-4">
      {/* Festival presets */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">Festival Bonus Quick-Create</h3>
        <div className="flex flex-wrap gap-2">
          {FESTIVAL_PRESETS.map(p => (
            <button key={p.name} onClick={() => applyPreset(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-50">
              <Star size={12} /> {p.name}
            </button>
          ))}
          <button onClick={() => { setForm({ ...emptyForm, type: 'ANNUAL', calculationMethod: 'seniority_tiered', proRataEnabled: true }); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50">
            <Calendar size={12} /> Annual Bonus
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{filteredPlans.length} bonus plans{filterDept ? ` for ${filterDept}` : ''}</p>
        <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Create Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">{editPlan?.id ? 'Edit Bonus Plan' : 'Create Bonus Plan'}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Dashain Bonus 2026" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {BONUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Calculation Method</label>
              <select value={form.calculationMethod} onChange={e => setForm({ ...form, calculationMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="fixed">Fixed Amount</option>
                <option value="salary_percentage">Salary Percentage</option>
                <option value="seniority_tiered">Seniority Tiered</option>
                <option value="pro_rata">Pro-Rata (months worked)</option>
              </select>
            </div>
          </div>

          {/* Amount based on method */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(form.calculationMethod === 'fixed' || form.calculationMethod === 'seniority_tiered') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Base Amount (NPR)</label>
                <input type="number" value={form.baseAmount} onChange={e => setForm({ ...form, baseAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="10000" />
              </div>
            )}
            {form.calculationMethod === 'salary_percentage' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salary % (of basic)</label>
                <input type="number" value={form.salaryPercentage} onChange={e => setForm({ ...form, salaryPercentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="100" step="0.1" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Cap (NPR)</label>
              <input type="number" value={form.maxCap} onChange={e => setForm({ ...form, maxCap: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fiscal Year</label>
              <input type="number" value={form.fiscalYear} onChange={e => setForm({ ...form, fiscalYear: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bonus Month</label>
              <select value={form.bonusMonth} onChange={e => setForm({ ...form, bonusMonth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Any</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
          </div>

          {form.type === 'FESTIVAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Festival Name</label>
              <input value={form.festivalName} onChange={e => setForm({ ...form, festivalName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm max-w-xs" placeholder="e.g. Dashain, Tihar" />
            </div>
          )}

          {/* Seniority tiers */}
          {form.calculationMethod === 'seniority_tiered' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Seniority Tiers (base × multiplier)</label>
              <div className="space-y-2">
                {form.seniorityTiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg text-sm">
                    <span className="text-xs text-gray-500">Years:</span>
                    <input type="number" value={tier.minYears} onChange={e => {
                      const t = [...form.seniorityTiers]; t[i] = { ...t[i], minYears: Number(e.target.value) }; setForm({ ...form, seniorityTiers: t });
                    }} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <span className="text-xs text-gray-500">to</span>
                    <input type="number" value={tier.maxYears || ''} onChange={e => {
                      const t = [...form.seniorityTiers]; t[i] = { ...t[i], maxYears: e.target.value ? Number(e.target.value) : null }; setForm({ ...form, seniorityTiers: t });
                    }} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm" placeholder="∞" />
                    <span className="text-xs text-gray-500">Multiplier:</span>
                    <input type="number" step="0.1" value={tier.multiplier} onChange={e => {
                      const t = [...form.seniorityTiers]; t[i] = { ...t[i], multiplier: Number(e.target.value) }; setForm({ ...form, seniorityTiers: t });
                    }} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={() => {
                      setForm({ ...form, seniorityTiers: form.seniorityTiers.filter((_, j) => j !== i) });
                    }} className="text-red-500 hover:text-red-700"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setForm({ ...form, seniorityTiers: [...form.seniorityTiers, { minYears: 0, maxYears: null, multiplier: 1 }] })}
                  className="text-xs text-blue-600 font-medium">+ Add Tier</button>
              </div>
            </div>
          )}

          {/* Departments */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Applicable Departments</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DEPARTMENTS.map(dept => {
                const active = form.applicableDepartments.includes(dept);
                const Icon = DEPT_ICONS[dept] || Building2;
                return (
                  <button key={dept} type="button" onClick={() => setForm({
                    ...form,
                    applicableDepartments: active
                      ? form.applicableDepartments.filter(d => d !== dept)
                      : [...form.applicableDepartments, dept]
                  })} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                    <Icon size={14} /> {dept}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave empty to apply to all departments</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Bonus description..." />
          </div>

          {/* Eligibility Criteria */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-amber-800">Eligibility Criteria</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Service Days</label>
                <input type="number" value={form.minServiceDays} onChange={e => setForm({ ...form, minServiceDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Attendance %</label>
                <input type="number" value={form.minAttendancePct} onChange={e => setForm({ ...form, minAttendancePct: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 90" step="0.1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Performance Score</label>
                <input type="number" value={form.minPerformanceScore} onChange={e => setForm({ ...form, minPerformanceScore: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 70" step="0.1" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allowProbation} onChange={e => setForm({ ...form, allowProbation: e.target.checked })} className="rounded" />
                Allow Probation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.proRataEnabled} onChange={e => setForm({ ...form, proRataEnabled: e.target.checked })} className="rounded" />
                Pro-rata for Partial Year
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requireNoUnpaidLeave} onChange={e => setForm({ ...form, requireNoUnpaidLeave: e.target.checked })} className="rounded" />
                No Unpaid Leave
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} className="rounded" />
                Taxable
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {submitting ? 'Saving...' : editPlan?.id ? 'Update Plan' : 'Create Plan'}
            </button>
            {editPlan?.id && <button type="button" onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">Cancel Edit</button>}
          </div>
        </form>
      )}

      {calcModal && <CalcModal planId={calcModal} fiscalYear={fiscalYear} onClose={() => setCalcModal(null)} onDone={() => { setCalcModal(null); onRefresh(); }} />}

      {/* Plans list */}
      <div className="space-y-3">
        {filteredPlans.map(plan => {
          const Icon = TYPE_ICONS[plan.type] || Gift;
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
                    <p className="text-xs text-gray-500">
                      {plan.type} · {plan.calculationMethod} · FY {plan.fiscalYear || '-'}
                      {plan.festivalName && ` · ${plan.festivalName}`}
                      {' · '}{plan._count?.employeeBonuses || 0} records
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plan.status]}`}>
                    {plan.status}
                  </span>
                  <button onClick={() => { setEditPlan(plan); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  {['DRAFT', 'ACTIVE'].includes(plan.status) && (
                    <button onClick={() => setCalcModal(plan.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100">
                      <Calculator size={14} /> Calculate
                    </button>
                  )}
                  {plan.status === 'DRAFT' && (
                    <button onClick={() => handleStatusChange(plan.id, 'ACTIVE')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100">
                      Activate
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

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                {plan.calculationMethod === 'fixed' && <span>Base: NPR {Number(plan.baseAmount).toLocaleString()}</span>}
                {plan.calculationMethod === 'salary_percentage' && <span>{Number(plan.salaryPercentage)}% of basic salary</span>}
                {plan.calculationMethod === 'seniority_tiered' && <span>Seniority-based tiers</span>}
                {plan.maxCap && <span>Max Cap: NPR {Number(plan.maxCap).toLocaleString()}</span>}
                {plan.minServiceDays > 0 && <span>Min {plan.minServiceDays} service days</span>}
                {plan.minAttendancePct && <span>Min {Number(plan.minAttendancePct)}% attendance</span>}
                {plan.minPerformanceScore && <span>Min {Number(plan.minPerformanceScore)} KPI score</span>}
                {!plan.allowProbation && <span className="text-amber-600">No probation</span>}
                {plan.proRataEnabled && <span className="text-blue-500">Pro-rata enabled</span>}
              </div>
            </div>
          );
        })}
        {filteredPlans.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No bonus plans found. Create one above or use a festival preset.</div>
        )}
      </div>
    </div>
  );
}

// ─── Calculate Modal ────────────────────────────────────────────────────────

function CalcModal({ planId, fiscalYear, onClose, onDone }) {
  const [year, setYear] = useState(fiscalYear);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function run() {
    setLoading(true);
    try {
      const res = await api.calculateBonuses(planId, { fiscalYear: year, bonusMonth: month ? Number(month) : null });
      setResult(res);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">Calculate Bonuses</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fiscal Year</label>
                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bonus Month (optional)</label>
                <select value={month} onChange={e => setMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Full Year</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={run} disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              <Play size={16} /> {loading ? 'Calculating...' : 'Run Calculation'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-lg font-bold text-blue-700">{result.totalEmployees}</p>
                <p className="text-xs text-gray-500">Total Employees</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-lg font-bold text-emerald-700">{result.eligible}</p>
                <p className="text-xs text-gray-500">Eligible</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-lg font-bold text-red-700">{result.ineligible}</p>
                <p className="text-xs text-gray-500">Ineligible</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">NPR {result.totalAmount?.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Bonus Amount</p>
            </div>

            {result.results?.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-600">Employee</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-600">Dept</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-600">Amount</th>
                      <th className="text-center px-3 py-2 text-xs text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{r.department}</td>
                        <td className="px-3 py-2 text-right">NPR {r.netAmount?.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          {r.eligible
                            ? <CheckCircle size={14} className="text-emerald-500 inline" />
                            : <span className="text-xs text-red-500" title={r.reasons?.join(', ')}><XCircle size={14} className="inline" /></span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button onClick={onDone} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Records Tab ────────────────────────────────────────────────────────────

function RecordsTab({ records, filterDept, fiscalYear, filterStatus, setFilterStatus, plans, onRefresh }) {
  const [selected, setSelected] = useState([]);

  const filtered = filterDept
    ? records.filter(r => r.employee?.department === filterDept)
    : records;

  async function handleBulkAction(action) {
    if (selected.length === 0) return;
    try {
      if (action === 'pay') {
        await api.markBonusesPaid({ bonusIds: selected });
      } else {
        await api.bulkReviewBonuses({ bonusIds: selected, action });
      }
      setSelected([]);
      onRefresh();
    } catch (err) { alert(err.message); }
  }

  function toggleAll() {
    const reviewable = filtered.filter(r => ['CALCULATED', 'PENDING_APPROVAL'].includes(r.status));
    setSelected(s => s.length === reviewable.length ? [] : reviewable.map(r => r.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">All Statuses</option>
            <option value="CALCULATED">Calculated</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAID">Paid</option>
          </select>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{selected.length} selected</span>
            <button onClick={() => handleBulkAction('approve')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100">
              <CheckCircle size={14} /> Approve
            </button>
            <button onClick={() => handleBulkAction('reject')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100">
              <XCircle size={14} /> Reject
            </button>
            <button onClick={() => handleBulkAction('pay')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100">
              <DollarSign size={14} /> Mark Paid
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" onChange={toggleAll} checked={selected.length > 0 && selected.length === filtered.filter(r => ['CALCULATED', 'PENDING_APPROVAL'].includes(r.status)).length} className="rounded" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Plan</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Net</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">Eligible</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(rec => (
              <tr key={rec.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  {['CALCULATED', 'PENDING_APPROVAL'].includes(rec.status) && (
                    <input type="checkbox" checked={selected.includes(rec.id)} onChange={() => setSelected(s => s.includes(rec.id) ? s.filter(x => x !== rec.id) : [...s, rec.id])} className="rounded" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{rec.employee?.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{rec.employee?.department}</td>
                <td className="px-4 py-3 text-xs">{rec.bonusPlan?.name} <span className="text-gray-400">({rec.bonusPlan?.type})</span></td>
                <td className="px-4 py-3 text-right font-medium">NPR {Number(rec.finalAmount).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">NPR {Number(rec.netAmount).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  {rec.eligible
                    ? <CheckCircle size={14} className="text-emerald-500 inline" />
                    : <span title={rec.ineligibleReason}><XCircle size={14} className="text-red-500 inline" /></span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rec.status]}`}>{rec.status.replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No bonus records for this period</div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Tab ────────────────────────────────────────────────────────────

function SummaryTab({ summary, fiscalYear }) {
  if (!summary) return <p className="text-gray-500 text-sm">Loading...</p>;

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
          <p className="text-sm text-amber-700 font-medium">{summary.pendingApproval} bonuses pending approval</p>
        </div>
      )}

      {/* By Department */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">By Department</h3>
        <div className="space-y-2">
          {Object.entries(summary.byDepartment || {}).map(([dept, data]) => {
            const Icon = DEPT_ICONS[dept] || Building2;
            return (
              <div key={dept} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{dept}</span>
                  <span className="text-xs text-gray-400">({data.eligible} eligible, {data.ineligible} ineligible)</span>
                </div>
                <span className="text-sm font-medium text-gray-900">NPR {data.total?.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">By Plan</h3>
        <div className="space-y-2">
          {Object.entries(summary.byPlan || {}).map(([plan, data]) => {
            const Icon = TYPE_ICONS[data.type] || Gift;
            return (
              <div key={plan} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{plan}</span>
                  <span className="text-xs text-gray-400">({data.count} records)</span>
                </div>
                <span className="text-sm font-medium text-gray-900">NPR {data.total?.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );
}
