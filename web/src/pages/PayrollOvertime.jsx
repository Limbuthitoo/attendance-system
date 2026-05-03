import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  DollarSign, Calculator, Clock, Download, RefreshCw, Check, X, AlertTriangle,
  ChevronDown, Users, Calendar, TrendingUp
} from 'lucide-react';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Tabs({ active, onChange }) {
  const tabs = [
    { id: 'payroll', label: 'Payroll Summary', icon: DollarSign },
    { id: 'overtime-policies', label: 'Overtime Policies', icon: Clock },
    { id: 'overtime-records', label: 'Overtime Records', icon: TrendingUp },
  ];
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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

// ── Payroll Policy Modal ────────────────────────────────────────────────────

function PolicyModal({ policy, onClose, onSubmit }) {
  const [form, setForm] = useState(policy || {
    name: '', overtimeAfterHours: 8, maxOvertimeHoursDaily: 4,
    overtimeRateMultiplier: 1.5, weekendRateMultiplier: 2.0, holidayRateMultiplier: 2.0,
    requiresApproval: true,
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
        <h3 className="text-lg font-semibold mb-4">{policy ? 'Edit' : 'Create'} Overtime Policy</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Policy Name</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Standard Overtime" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">OT After (hours)</label>
              <input type="number" step="0.5" required value={form.overtimeAfterHours}
                onChange={e => setForm(f => ({ ...f, overtimeAfterHours: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Daily OT</label>
              <input type="number" step="0.5" value={form.maxOvertimeHoursDaily}
                onChange={e => setForm(f => ({ ...f, maxOvertimeHoursDaily: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Normal Rate</label>
              <input type="number" step="0.25" value={form.overtimeRateMultiplier}
                onChange={e => setForm(f => ({ ...f, overtimeRateMultiplier: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weekend Rate</label>
              <input type="number" step="0.25" value={form.weekendRateMultiplier}
                onChange={e => setForm(f => ({ ...f, weekendRateMultiplier: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Rate</label>
              <input type="number" step="0.25" value={form.holidayRateMultiplier}
                onChange={e => setForm(f => ({ ...f, holidayRateMultiplier: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requiresApproval}
              onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))}
              className="rounded" />
            <span className="text-sm text-slate-700">Requires manual approval</span>
          </label>
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

// ── Main Component ──────────────────────────────────────────────────────────

export default function PayrollOvertime() {
  const [tab, setTab] = useState('payroll');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);

  // Payroll
  const [payrollData, setPayrollData] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Overtime
  const [policies, setPolicies] = useState([]);
  const [otRecords, setOtRecords] = useState({ records: [], pagination: {} });
  const [otFilter, setOtFilter] = useState({ status: '', page: 1 });
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editPolicy, setEditPolicy] = useState(null);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPayrollSummaries(year, month);
      setPayrollData(data);
    } catch { setPayrollData(null); }
    setLoading(false);
  }, [year, month]);

  const loadPolicies = useCallback(async () => {
    try { const d = await api.getOvertimePolicies(); setPolicies(d.policies || []); } catch { /* ignore */ }
  }, []);

  const loadOtRecords = useCallback(async () => {
    try { const d = await api.getOvertimeRecords(otFilter); setOtRecords(d); } catch { /* ignore */ }
  }, [otFilter]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);
  useEffect(() => { if (tab === 'payroll') loadPayroll(); }, [tab, loadPayroll]);
  useEffect(() => { if (tab === 'overtime-records') loadOtRecords(); }, [tab, loadOtRecords]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.generatePayroll(year, month);
      alert(`Payroll generated for ${result.generated} employees (${result.totalWorkDays} work days)`);
      loadPayroll();
    } catch (err) { alert(err.message || 'Failed to generate payroll'); }
    setGenerating(false);
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportPayrollCsv(year, month);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${year}-${String(month).padStart(2, '0')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const handleSavePolicy = async (form) => {
    if (editPolicy) {
      await api.updateOvertimePolicy(editPolicy.id, form);
    } else {
      await api.createOvertimePolicy(form);
    }
    loadPolicies();
    setEditPolicy(null);
  };

  const handleReviewOt = async (id, status) => {
    try { await api.reviewOvertime(id, status); loadOtRecords(); } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll & Overtime</h1>
          <p className="text-sm text-slate-500 mt-1">Generate payroll summaries, manage overtime policies and approvals</p>
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} />

      {/* ── Payroll Tab ─────────────────────────────────────────────────── */}
      {tab === 'payroll' && (
        <>
          <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-24" />
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              <Calculator size={14} />{generating ? 'Generating...' : 'Generate Payroll'}
            </button>
            {payrollData && payrollData.summaries.length > 0 && (
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                <Download size={14} />Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : !payrollData || payrollData.summaries.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No payroll data</h3>
              <p className="text-sm text-slate-500 mt-1">Click "Generate Payroll" to calculate the monthly summary.</p>
            </div>
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Employees</span>
                  <p className="text-2xl font-bold mt-1">{payrollData.employeeCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Total Work Hours</span>
                  <p className="text-2xl font-bold mt-1">{Math.round(payrollData.totals.totalWorkHours)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Overtime Hours</span>
                  <p className="text-2xl font-bold mt-1 text-amber-700">{Math.round(payrollData.totals.overtimeHours)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Effective Days (total)</span>
                  <p className="text-2xl font-bold mt-1">{Math.round(payrollData.totals.effectiveDays)}</p>
                </div>
              </div>

              {/* Table */}
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
                      {payrollData.summaries.map(s => (
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
            </>
          )}
        </>
      )}

      {/* ── Overtime Policies Tab ─────────────────────────────────────── */}
      {tab === 'overtime-policies' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setEditPolicy(null); setShowPolicyModal(true); }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              + Create Policy
            </button>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <Clock size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No overtime policies</h3>
              <p className="text-sm text-slate-500 mt-1">Create an overtime policy to enable automatic overtime tracking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map(p => (
                <div key={p.id} className={`bg-white rounded-xl border ${p.isActive ? 'border-slate-200' : 'border-red-200'} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    {p.isActive ? (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-500">OT after</span><p className="font-medium">{Number(p.overtimeAfterHours)}h</p></div>
                    <div><span className="text-slate-500">Max daily</span><p className="font-medium">{Number(p.maxOvertimeHoursDaily)}h</p></div>
                    <div><span className="text-slate-500">Normal rate</span><p className="font-medium">{Number(p.overtimeRateMultiplier)}x</p></div>
                    <div><span className="text-slate-500">Weekend rate</span><p className="font-medium">{Number(p.weekendRateMultiplier)}x</p></div>
                    <div><span className="text-slate-500">Holiday rate</span><p className="font-medium">{Number(p.holidayRateMultiplier)}x</p></div>
                    <div><span className="text-slate-500">Approval</span><p className="font-medium">{p.requiresApproval ? 'Required' : 'Auto'}</p></div>
                  </div>
                  <button onClick={() => { setEditPolicy(p); setShowPolicyModal(true); }}
                    className="mt-3 text-xs text-primary-600 hover:text-primary-800 font-medium">Edit</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Overtime Records Tab ──────────────────────────────────────── */}
      {tab === 'overtime-records' && (
        <>
          <div className="flex gap-3">
            <select value={otFilter.status} onChange={e => setOtFilter(f => ({ ...f, status: e.target.value, page: 1 }))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="AUTO_APPROVED">Auto-Approved</option>
            </select>
            <button onClick={loadOtRecords} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {(!otRecords.records || otRecords.records.length === 0) ? (
              <div className="text-center py-16 text-slate-500">No overtime records found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        {['Date', 'Employee', 'Policy', 'Regular', 'Overtime', 'Rate', 'Status', 'Actions'].map(h => (
                          <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otRecords.records.map(r => {
                        const statusColors = {
                          PENDING: 'text-amber-700 bg-amber-50',
                          APPROVED: 'text-green-700 bg-green-50',
                          REJECTED: 'text-red-700 bg-red-50',
                          AUTO_APPROVED: 'text-blue-700 bg-blue-50',
                        };
                        return (
                          <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-sm">{new Date(r.date).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3">
                              <div className="text-sm font-medium">{r.employee?.name}</div>
                              <div className="text-xs text-slate-500">{r.employee?.department}</div>
                            </td>
                            <td className="py-2.5 px-3 text-xs">{r.policy?.name}</td>
                            <td className="py-2.5 px-3 text-sm">{Number(r.regularHours).toFixed(1)}h</td>
                            <td className="py-2.5 px-3 text-sm font-bold text-amber-700">{Number(r.overtimeHours).toFixed(1)}h</td>
                            <td className="py-2.5 px-3 text-sm">{Number(r.rateMultiplier)}x</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[r.status]}`}>{r.status}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {r.status === 'PENDING' && (
                                <div className="flex gap-1">
                                  <button onClick={() => handleReviewOt(r.id, 'APPROVED')}
                                    className="p-1 rounded bg-green-50 text-green-700 hover:bg-green-100" title="Approve">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => handleReviewOt(r.id, 'REJECTED')}
                                    className="p-1 rounded bg-red-50 text-red-700 hover:bg-red-100" title="Reject">
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                              {r.approver && <span className="text-xs text-slate-500">by {r.approver.name}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {otRecords.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500">Page {otRecords.pagination.page} of {otRecords.pagination.totalPages}</span>
                    <div className="flex gap-2">
                      <button disabled={otRecords.pagination.page <= 1}
                        onClick={() => setOtFilter(f => ({ ...f, page: f.page - 1 }))}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50">Prev</button>
                      <button disabled={otRecords.pagination.page >= otRecords.pagination.totalPages}
                        onClick={() => setOtFilter(f => ({ ...f, page: f.page + 1 }))}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal
          policy={editPolicy}
          onClose={() => { setShowPolicyModal(false); setEditPolicy(null); }}
          onSubmit={handleSavePolicy}
        />
      )}
    </div>
  );
}
