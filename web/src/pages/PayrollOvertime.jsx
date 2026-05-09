import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  DollarSign, Calculator, Clock, Download, RefreshCw, Check, X,
  ChevronDown, Users, Calendar, TrendingUp, Lock, Unlock, Settings,
  Plus, CreditCard, FileText, Eye
} from 'lucide-react';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Tabs({ active, onChange }) {
  const tabs = [
    { id: 'payslips', label: 'Payslips', icon: FileText },
    { id: 'salary', label: 'Salary Structures', icon: DollarSign },
    { id: 'attendance', label: 'Attendance Summary', icon: Calendar },
    { id: 'overtime', label: 'Overtime', icon: Clock },
    { id: 'loans', label: 'Advance Salary', icon: CreditCard },
    { id: 'config', label: 'Config', icon: Settings },
  ];
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              active === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon size={16} />{t.label}
          </button>
        );
      })}
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Tax Slab Editor ─────────────────────────────────────────────────────────
function TaxSlabEditor({ label, value, onChange }) {
  const parseSlabs = (v) => {
    try {
      const arr = typeof v === 'string' ? JSON.parse(v) : v;
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  };

  const slabs = parseSlabs(value);

  const updateSlab = (idx, field, val) => {
    const updated = [...slabs];
    updated[idx] = { ...updated[idx], [field]: val === '' ? null : Number(val) };
    onChange(JSON.stringify(updated));
  };

  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const newMin = last ? (last.max || 0) : 0;
    onChange(JSON.stringify([...slabs, { min: newMin, max: null, rate: 0 }]));
  };

  const removeSlab = (idx) => {
    onChange(JSON.stringify(slabs.filter((_, i) => i !== idx)));
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{label}</h4>
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 mb-2">
          <span className="text-xs font-medium text-slate-500">From (NPR)</span>
          <span className="text-xs font-medium text-slate-500">Up to (NPR)</span>
          <span className="text-xs font-medium text-slate-500">Rate %</span>
          <span></span>
        </div>
        {slabs.map((slab, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 mb-2 items-center">
            <input type="number" value={slab.min ?? ''} onChange={e => updateSlab(idx, 'min', e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="0" />
            <input type="number" value={slab.max ?? ''} onChange={e => updateSlab(idx, 'max', e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="No limit" />
            <input type="number" step="0.5" value={slab.rate ?? ''} onChange={e => updateSlab(idx, 'rate', e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="%" />
            <button type="button" onClick={() => removeSlab(idx)}
              className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Remove">
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addSlab}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium mt-1">
          <Plus size={12} />Add slab
        </button>
      </div>
    </div>
  );
}

// ── Salary Structure Modal ──────────────────────────────────────────────────
function SalaryModal({ employees, config, onClose, onSubmit }) {
  const [form, setForm] = useState({
    employeeId: '', grossSalary: '', basicSalary: '', effectiveFrom: new Date().toISOString().split('T')[0],
    allowances: { dearness: '', transport: '', housing: '', medical: '' },
  });
  const [loading, setLoading] = useState(false);

  const handleGrossChange = (val) => {
    const gross = parseFloat(val) || 0;
    const basicPct = config?.payroll_basic_salary_pct || 60;
    setForm(f => ({ ...f, grossSalary: val, basicSalary: String(Math.round(gross * basicPct / 100)) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const allowances = {};
      Object.entries(form.allowances).forEach(([k, v]) => { if (v) allowances[k] = parseFloat(v); });
      await onSubmit({ ...form, allowances });
      onClose();
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Set Salary Structure</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gross Salary (NPR)</label>
              <input type="number" required value={form.grossSalary} onChange={e => handleGrossChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Basic Salary (NPR)</label>
              <input type="number" required value={form.basicSalary}
                onChange={e => setForm(f => ({ ...f, basicSalary: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <span className="text-xs text-slate-500">{config?.payroll_basic_salary_pct || 60}% of gross</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
            <input type="date" required value={form.effectiveFrom}
              onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowances (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(form.allowances).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-0.5 capitalize">{key}</label>
                  <input type="number" value={val} placeholder="0"
                    onChange={e => setForm(f => ({ ...f, allowances: { ...f.allowances, [key]: e.target.value } }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Advance Salary Modal ──────────────────────────────────────────────────────────────
function AdvanceSalaryModal({ employees, onClose, onSubmit }) {
  const [form, setForm] = useState({
    employeeId: '', totalAmount: '', monthlyDeduction: '', description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit(form); onClose(); } catch (err) { alert(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Add Advance Salary</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
              <input type="number" required value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Deduction</label>
              <input type="number" required value={form.monthlyDeduction}
                onChange={e => setForm(f => ({ ...f, monthlyDeduction: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Salary advance for house rent" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Payslip Detail Modal ────────────────────────────────────────────────────
function PayslipDetailModal({ payslip, onClose }) {
  if (!payslip) return null;
  const p = payslip;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold">{p.employee?.name}</h3>
            <p className="text-sm text-slate-500">{p.employee?.department} &middot; {p.employee?.designation}</p>
            <p className="text-xs text-slate-400 mt-1">{months[p.month - 1]} {p.year}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            p.status === 'PAID' ? 'bg-green-50 text-green-700' :
            p.status === 'LOCKED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
          }`}>{p.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Earnings */}
          <div>
            <h4 className="text-sm font-semibold text-green-700 border-b border-green-100 pb-2 mb-3">Earnings</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span className="font-medium">Rs. {fmt(p.basicSalary)}</span></div>
              {Object.entries(p.allowances || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-slate-600 capitalize">{k} Allowance</span><span>Rs. {fmt(v)}</span></div>
              ))}
              {Number(p.overtimeAmount) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Overtime ({Number(p.overtimeHours).toFixed(1)}h)</span><span>Rs. {fmt(p.overtimeAmount)}</span></div>
              )}
              {Number(p.bonus) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Bonus</span><span>Rs. {fmt(p.bonus)}</span></div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t border-green-100">
                <span>Gross Earnings</span><span className="text-green-700">Rs. {fmt(p.grossEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h4 className="text-sm font-semibold text-red-700 border-b border-red-100 pb-2 mb-3">Deductions</h4>
            <div className="space-y-2 text-sm">
              {Number(p.employeeSsf) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">SSF (Employee)</span><span>Rs. {fmt(p.employeeSsf)}</span></div>
              )}
              {Number((p.otherDeductions || {}).employeePf) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Provident Fund (Employee)</span><span>Rs. {fmt(p.otherDeductions.employeePf)}</span></div>
              )}
              {Number((p.otherDeductions || {}).employeeCit) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">CIT (Employee)</span><span>Rs. {fmt(p.otherDeductions.employeeCit)}</span></div>
              )}
              {Number(p.tds) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">TDS (Income Tax)</span><span>Rs. {fmt(p.tds)}</span></div>
              )}
              {Number(p.unpaidLeaveDeduction) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Unpaid Leave ({p.unpaidLeaveDays}d)</span><span>Rs. {fmt(p.unpaidLeaveDeduction)}</span></div>
              )}
              {Number(p.absenceDeduction) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Absence ({p.absentDays}d)</span><span>Rs. {fmt(p.absenceDeduction)}</span></div>
              )}
              {Number(p.advanceSalaryDeduction) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Advance Salary</span><span>Rs. {fmt(p.advanceSalaryDeduction)}</span></div>
              )}
              {Number((p.otherDeductions || {}).festivalAdvanceDeduction) > 0 && (
                <div className="flex justify-between"><span className="text-slate-600">Festival Advance</span><span>Rs. {fmt(p.otherDeductions.festivalAdvanceDeduction)}</span></div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t border-red-100">
                <span>Total Deductions</span><span className="text-red-700">Rs. {fmt(p.totalDeductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-slate-50 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-xs text-slate-500 block">Net Salary</span>
              <span className="text-xl font-bold text-primary-700">Rs. {fmt(p.netSalary)}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Employer SSF</span>
              <span className="text-lg font-semibold text-slate-700">Rs. {fmt(p.employerSsf)}</span>
            </div>
            {Number((p.otherDeductions || {}).employerPf) > 0 && (
              <div>
                <span className="text-xs text-slate-500 block">Employer PF</span>
                <span className="text-lg font-semibold text-slate-700">Rs. {fmt(p.otherDeductions.employerPf)}</span>
              </div>
            )}
            {Number((p.otherDeductions || {}).employerGratuity) > 0 && (
              <div>
                <span className="text-xs text-slate-500 block">Gratuity</span>
                <span className="text-lg font-semibold text-slate-700">Rs. {fmt(p.otherDeductions.employerGratuity)}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-500 block">Company Cost</span>
              <span className="text-lg font-semibold text-slate-700">Rs. {fmt(p.companyCost)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-4 text-xs text-slate-500">
          <span>Work Days: {p.totalWorkDays}</span>
          <span>Present: {p.presentDays}</span>
          <span>Absent: {p.absentDays}</span>
          <span>OT: {Number(p.overtimeHours).toFixed(1)}h</span>
        </div>

        <button onClick={onClose} className="mt-4 w-full py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function PayrollOvertime() {
  const [tab, setTab] = useState('payslips');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  const [payslipData, setPayslipData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const [salaryStructures, setSalaryStructures] = useState([]);
  const [showSalaryModal, setShowSalaryModal] = useState(false);

  const [attendanceData, setAttendanceData] = useState(null);

  const [policies, setPolicies] = useState([]);
  const [otRecords, setOtRecords] = useState({ records: [], pagination: {} });
  const [otFilter, setOtFilter] = useState({ status: '', page: 1 });

  const [advances, setAdvances] = useState([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.getEmployees?.()?.then(d => setEmployees(d.employees || d || []))?.catch(() => {});
  }, []);

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    try { const d = await api.getPayslips(year, month); setPayslipData(d); } catch { setPayslipData(null); }
    setLoading(false);
  }, [year, month]);

  const loadSalary = useCallback(async () => {
    try { const d = await api.getSalaryStructures(); setSalaryStructures(d.structures || []); } catch { /* */ }
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try { const d = await api.getPayrollSummaries(year, month); setAttendanceData(d); } catch { setAttendanceData(null); }
    setLoading(false);
  }, [year, month]);

  const loadPolicies = useCallback(async () => {
    try { const d = await api.getOvertimePolicies(); setPolicies(d.policies || []); } catch { /* */ }
  }, []);

  const loadOtRecords = useCallback(async () => {
    try { const d = await api.getOvertimeRecords(otFilter); setOtRecords(d); } catch { /* */ }
  }, [otFilter]);

  const loadAdvances = useCallback(async () => {
    try { const d = await api.getAdvanceSalaries(); setAdvances(d.advances || []); } catch { /* */ }
  }, []);

  const loadConfig = useCallback(async () => {
    try { const d = await api.getPayrollConfig(); setConfig(d); } catch { /* */ }
  }, []);

  useEffect(() => { loadPolicies(); loadConfig(); }, [loadPolicies, loadConfig]);
  useEffect(() => { if (tab === 'payslips') loadPayslips(); }, [tab, loadPayslips]);
  useEffect(() => { if (tab === 'salary') loadSalary(); }, [tab, loadSalary]);
  useEffect(() => { if (tab === 'attendance') loadAttendance(); }, [tab, loadAttendance]);
  useEffect(() => { if (tab === 'overtime') loadOtRecords(); }, [tab, loadOtRecords]);
  useEffect(() => { if (tab === 'loans') loadAdvances(); }, [tab, loadAdvances]);

  const handleGeneratePayslips = async () => {
    setGenerating(true);
    try {
      await api.generatePayroll(year, month);
      const result = await api.generatePayslips(year, month);
      alert(`Payslips generated for ${result.generated} employees`);
      loadPayslips();
    } catch (err) { alert(err.message || 'Failed to generate payslips'); }
    setGenerating(false);
  };

  const handleLock = async () => {
    if (!confirm('Lock payroll? This prevents further edits.')) return;
    try { await api.lockPayroll(year, month); loadPayslips(); } catch (err) { alert(err.message); }
  };

  const handleUnlock = async () => {
    try { await api.unlockPayroll(year, month); loadPayslips(); } catch (err) { alert(err.message); }
  };

  const handleMarkPaid = async () => {
    if (!confirm('Mark all as paid? This is the final step.')) return;
    try { await api.markPayrollPaid(year, month); loadPayslips(); } catch (err) { alert(err.message); }
  };

  const handleExportPayslips = async () => {
    try {
      const res = await api.exportPayslipsCsv(year, month);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payslips-${year}-${String(month).padStart(2, '0')}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const handleSaveSalary = async (form) => {
    await api.saveSalaryStructure(form);
    loadSalary();
  };

  const handleCreateAdvance = async (form) => {
    await api.createAdvanceSalary(form);
    loadAdvances();
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updatePayrollConfig(config);
      setConfig(updated);
      alert('Configuration saved');
    } catch (err) { alert(err.message); }
  };

  const handleReviewOt = async (id, status) => {
    try { await api.reviewOvertime(id, status); loadOtRecords(); } catch (err) { alert(err.message); }
  };

  const MonthYearControls = ({ onAction, actionLabel, actionDisabled, actionIcon: ActionIcon, extra }) => (
    <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <Calendar size={16} className="text-slate-400" />
      <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
        {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-24" />
      {onAction && (
        <button onClick={onAction} disabled={actionDisabled}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {ActionIcon && <ActionIcon size={14} />}{actionLabel}
        </button>
      )}
      {extra}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll & Overtime</h1>
          <p className="text-sm text-slate-500 mt-1">Salary management, payslips, overtime, and advance salary tracking</p>
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} />

      {/* ═══ PAYSLIPS TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'payslips' && (
        <>
          <MonthYearControls
            onAction={handleGeneratePayslips}
            actionLabel={generating ? 'Generating...' : 'Generate Payslips'}
            actionDisabled={generating}
            actionIcon={Calculator}
            extra={payslipData && payslipData.payslips?.length > 0 && (
              <div className="flex gap-2 ml-auto">
                {payslipData.payslips.some(p => p.status === 'DRAFT') && (
                  <button onClick={handleLock} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
                    <Lock size={14} />Lock
                  </button>
                )}
                {payslipData.payslips.some(p => p.status === 'LOCKED') && (
                  <>
                    <button onClick={handleUnlock} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Unlock size={14} />Unlock
                    </button>
                    <button onClick={handleMarkPaid} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      <Check size={14} />Mark Paid
                    </button>
                  </>
                )}
                <button onClick={handleExportPayslips} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <Download size={14} />Export
                </button>
              </div>
            )}
          />

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : !payslipData || !payslipData.payslips?.length ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No payslips generated</h3>
              <p className="text-sm text-slate-500 mt-1">Set salary structures first, then click "Generate Payslips".</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Employees</span>
                  <p className="text-lg font-bold mt-0.5">{payslipData.employeeCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Gross</span>
                  <p className="text-lg font-bold mt-0.5 text-green-700">Rs. {fmt(payslipData.totals.grossEarnings)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Deductions</span>
                  <p className="text-lg font-bold mt-0.5 text-red-700">Rs. {fmt(payslipData.totals.totalDeductions)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Net Payout</span>
                  <p className="text-lg font-bold mt-0.5 text-primary-700">Rs. {fmt(payslipData.totals.netSalary)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Employee SSF</span>
                  <p className="text-lg font-bold mt-0.5">Rs. {fmt(payslipData.totals.employeeSsf)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Employer SSF</span>
                  <p className="text-lg font-bold mt-0.5">Rs. {fmt(payslipData.totals.employerSsf)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs text-slate-500">Company Cost</span>
                  <p className="text-lg font-bold mt-0.5">Rs. {fmt(payslipData.totals.companyCost)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        {['Employee', 'Dept', 'Gross', 'SSF', 'TDS', 'Deductions', 'Net Salary', 'Status', ''].map(h => (
                          <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payslipData.payslips.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <div className="text-sm font-medium">{p.employee.name}</div>
                            <div className="text-xs text-slate-500">{p.employee.employeeCode}</div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-600">{p.employee.department}</td>
                          <td className="py-2.5 px-3 text-sm text-green-700 font-medium">Rs. {fmt(p.grossEarnings)}</td>
                          <td className="py-2.5 px-3 text-sm">Rs. {fmt(p.employeeSsf)}</td>
                          <td className="py-2.5 px-3 text-sm">Rs. {fmt(p.tds)}</td>
                          <td className="py-2.5 px-3 text-sm text-red-700">Rs. {fmt(p.totalDeductions)}</td>
                          <td className="py-2.5 px-3 text-sm font-bold text-primary-700">Rs. {fmt(p.netSalary)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              p.status === 'PAID' ? 'bg-green-50 text-green-700' :
                              p.status === 'LOCKED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>{p.status}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <button onClick={() => setSelectedPayslip(p)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700" title="View Details">
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ SALARY STRUCTURES TAB ════════════════════════════════════════════ */}
      {tab === 'salary' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowSalaryModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              <Plus size={14} />Set Salary
            </button>
          </div>

          {salaryStructures.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No salary structures</h3>
              <p className="text-sm text-slate-500 mt-1">Add salary structures for employees to generate payslips.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      {['Employee', 'Dept', 'Gross Salary', 'Basic', 'Allowances', 'Effective From'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salaryStructures.map(s => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="text-sm font-medium">{s.employee.name}</div>
                          <div className="text-xs text-slate-500">{s.employee.employeeCode}</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">{s.employee.department}</td>
                        <td className="py-2.5 px-3 text-sm font-bold">Rs. {fmt(s.grossSalary)}</td>
                        <td className="py-2.5 px-3 text-sm">Rs. {fmt(s.basicSalary)}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">
                          {Object.entries(s.allowances || {}).map(([k, v]) => `${k}: Rs.${fmt(v)}`).join(', ') || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-sm text-slate-600">{new Date(s.effectiveFrom).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ ATTENDANCE TAB ═══════════════════════════════════════════════════ */}
      {tab === 'attendance' && (
        <>
          <MonthYearControls
            onAction={async () => {
              setGenerating(true);
              try {
                await api.generatePayroll(year, month);
                loadAttendance();
              } catch (err) { alert(err.message); }
              setGenerating(false);
            }}
            actionLabel={generating ? 'Generating...' : 'Generate Summary'}
            actionDisabled={generating}
            actionIcon={Calculator}
          />

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : !attendanceData || !attendanceData.summaries?.length ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No attendance data</h3>
              <p className="text-sm text-slate-500 mt-1">Click "Generate Summary" to calculate.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      {['Employee', 'Dept', 'Work Days', 'Present', 'Absent', 'Late', 'Half', 'Leave', 'Hours', 'OT', 'Effective'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.summaries.map(s => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="text-sm font-medium">{s.employee.name}</div>
                          <div className="text-xs text-slate-500">{s.employee.employeeCode}</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">{s.employee.department}</td>
                        <td className="py-2.5 px-3 text-sm">{s.totalWorkDays}</td>
                        <td className="py-2.5 px-3 text-sm text-green-700">{s.presentDays}</td>
                        <td className="py-2.5 px-3 text-sm text-red-700">{s.absentDays}</td>
                        <td className="py-2.5 px-3 text-sm text-amber-700">{s.lateDays}</td>
                        <td className="py-2.5 px-3 text-sm text-purple-700">{s.halfDays}</td>
                        <td className="py-2.5 px-3 text-sm text-blue-700">{s.leaveDays}</td>
                        <td className="py-2.5 px-3 text-sm font-medium">{Number(s.totalWorkHours).toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-sm text-amber-700">{Number(s.overtimeHours).toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-sm font-bold">{Number(s.effectiveDays).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ OVERTIME TAB ═════════════════════════════════════════════════════ */}
      {tab === 'overtime' && (
        <>
          <div className="flex gap-3">
            <select value={otFilter.status} onChange={e => setOtFilter(f => ({ ...f, status: e.target.value, page: 1 }))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button onClick={loadOtRecords} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {policies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {policies.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <h4 className="font-medium text-sm">{p.name}</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>After: {Number(p.overtimeAfterHours)}h</span>
                    <span>Rate: {Number(p.overtimeRateMultiplier)}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {(!otRecords.records || otRecords.records.length === 0) ? (
              <div className="text-center py-12 text-slate-500">No overtime records</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      {['Date', 'Employee', 'Regular', 'OT', 'Rate', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {otRecords.records.map(r => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-sm">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 text-sm font-medium">{r.employee?.name}</td>
                        <td className="py-2.5 px-3 text-sm">{Number(r.regularHours).toFixed(1)}h</td>
                        <td className="py-2.5 px-3 text-sm font-bold text-amber-700">{Number(r.overtimeHours).toFixed(1)}h</td>
                        <td className="py-2.5 px-3 text-sm">{Number(r.rateMultiplier)}x</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.status === 'APPROVED' ? 'bg-green-50 text-green-700' :
                            r.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                            r.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                          }`}>{r.status}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.status === 'PENDING' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleReviewOt(r.id, 'APPROVED')} className="p-1 rounded bg-green-50 text-green-700 hover:bg-green-100"><Check size={14} /></button>
                              <button onClick={() => handleReviewOt(r.id, 'REJECTED')} className="p-1 rounded bg-red-50 text-red-700 hover:bg-red-100"><X size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ LOANS TAB ════════════════════════════════════════════════════════ */}
      {tab === 'loans' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowAdvanceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              <Plus size={14} />Add Advance Salary
            </button>
          </div>

          {advances.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <CreditCard size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No active advance salaries</h3>
              <p className="text-sm text-slate-500 mt-1">Add an advance salary to automatically deduct from payslips.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      {['Employee', 'Description', 'Total', 'Remaining', 'Monthly Ded.', 'Progress'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map(l => {
                      const progress = ((Number(l.totalAmount) - Number(l.remainingAmount)) / Number(l.totalAmount)) * 100;
                      return (
                        <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-sm font-medium">{l.employee?.name}</td>
                          <td className="py-2.5 px-3 text-sm text-slate-600">{l.description || '—'}</td>
                          <td className="py-2.5 px-3 text-sm">Rs. {fmt(l.totalAmount)}</td>
                          <td className="py-2.5 px-3 text-sm text-red-700">Rs. {fmt(l.remainingAmount)}</td>
                          <td className="py-2.5 px-3 text-sm">Rs. {fmt(l.monthlyDeduction)}</td>
                          <td className="py-2.5 px-3 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-slate-500">{Math.round(progress)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ CONFIG TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'config' && config && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-lg font-semibold">Payroll Configuration</h3>
          <p className="text-sm text-slate-500">These settings control how payslips are calculated. Changes apply to future generations.</p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Note:</strong> SSF rates, PF rates, CIT rates, and tax slabs are now managed per fiscal year in{' '}
            <a href="/statutory" className="font-medium text-amber-900 underline hover:text-amber-700">Nepal Statutory Compliance</a>.
            The payroll engine automatically picks the correct rates for each payslip based on the fiscal year. The fallback defaults below are used only if no fiscal year tax config exists.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Basic Salary %</label>
              <input type="number" step="1" value={config.payroll_basic_salary_pct}
                onChange={e => setConfig(c => ({ ...c, payroll_basic_salary_pct: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <span className="text-xs text-slate-500">Basic = Gross x this %</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">OT Rate Multiplier</label>
              <input type="number" step="0.25" value={config.payroll_overtime_multiplier}
                onChange={e => setConfig(c => ({ ...c, payroll_overtime_multiplier: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Working Hours/Day</label>
              <input type="number" step="0.5" value={config.payroll_working_hours_per_day}
                onChange={e => setConfig(c => ({ ...c, payroll_working_hours_per_day: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <details className="border border-slate-200 rounded-lg">
            <summary className="px-4 py-3 text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
              Fallback Defaults (used when no fiscal year tax config exists)
            </summary>
            <div className="p-4 space-y-4 border-t border-slate-200 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SSF Employee %</label>
                  <input type="number" step="0.5" value={config.payroll_ssf_employee_pct}
                    onChange={e => setConfig(c => ({ ...c, payroll_ssf_employee_pct: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SSF Employer %</label>
                  <input type="number" step="0.5" value={config.payroll_ssf_employer_pct}
                    onChange={e => setConfig(c => ({ ...c, payroll_ssf_employer_pct: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={config.payroll_ssf_enabled}
                      onChange={e => setConfig(c => ({ ...c, payroll_ssf_enabled: e.target.checked }))}
                      className="rounded" />
                    <span className="text-sm text-slate-700">SSF Enabled</span>
                  </label>
                </div>
              </div>

              <TaxSlabEditor
                label="Fallback Tax Slabs (Single) — Annual"
                value={config.payroll_tax_slabs_single}
                onChange={val => setConfig(c => ({ ...c, payroll_tax_slabs_single: val }))}
              />

              <TaxSlabEditor
                label="Fallback Tax Slabs (Married) — Annual"
                value={config.payroll_tax_slabs_married}
                onChange={val => setConfig(c => ({ ...c, payroll_tax_slabs_married: val }))}
              />
            </div>
          </details>

          <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            Save Configuration
          </button>
        </form>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showSalaryModal && (
        <SalaryModal employees={employees} config={config} onClose={() => setShowSalaryModal(false)} onSubmit={handleSaveSalary} />
      )}
      {showAdvanceModal && (
        <AdvanceSalaryModal employees={employees} onClose={() => setShowAdvanceModal(false)} onSubmit={handleCreateAdvance} />
      )}
      {selectedPayslip && (
        <PayslipDetailModal payslip={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </div>
  );
}
