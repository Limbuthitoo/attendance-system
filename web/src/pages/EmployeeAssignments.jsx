import { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Filter, MapPin, Clock, CalendarDays, History, X, Check, AlertTriangle } from 'lucide-react';
import { request } from '../lib/api/client';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';

const apiFetch = (path, options = {}) => request(`/v1${path}`, options);

export default function EmployeeAssignments() {
  const { dateFormat } = useSettings();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'

  // Filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterShift, setFilterShift] = useState('');

  // Assignment form
  const [form, setForm] = useState({ employeeId: '', employeeIds: [], branchId: '', shiftId: '', workScheduleId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [assignData, empData, branchData, shiftData, scheduleData] = await Promise.all([
        apiFetch('/settings/assignments'),
        apiFetch('/employees'),
        apiFetch('/branches'),
        apiFetch('/settings/shifts'),
        apiFetch('/settings/work-schedules'),
      ]);
      setAssignments(assignData.assignments || []);
      setEmployees(empData.employees || []);
      setBranches(branchData.branches || []);
      setShifts(shiftData.shifts || []);
      setSchedules(scheduleData.workSchedules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Employees without current assignments
  const unassigned = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.employee?.id));
    return employees.filter((e) => !assignedIds.has(e.id));
  }, [employees, assignments]);

  // Filtered assignments
  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (filterBranch && a.branch?.id !== filterBranch) return false;
      if (filterShift && a.shift?.id !== filterShift) return false;
      return true;
    });
  }, [assignments, filterBranch, filterShift]);

  function openSingleAssign(employeeId) {
    setMode('single');
    setForm({ employeeId: employeeId || '', employeeIds: [], branchId: '', shiftId: '', workScheduleId: '' });
    setError('');
    setShowAssignModal(true);
  }

  function openBulkAssign() {
    setMode('bulk');
    setForm({ employeeId: '', employeeIds: [], branchId: '', shiftId: '', workScheduleId: '' });
    setError('');
    setShowAssignModal(true);
  }

  function toggleBulkEmployee(id) {
    setForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(id)
        ? prev.employeeIds.filter((eid) => eid !== id)
        : [...prev.employeeIds, id],
    }));
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!form.branchId || !form.shiftId || !form.workScheduleId) {
      setError('Branch, shift, and schedule are required');
      return;
    }
    if (mode === 'single' && !form.employeeId) {
      setError('Select an employee');
      return;
    }
    if (mode === 'bulk' && form.employeeIds.length === 0) {
      setError('Select at least one employee');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (mode === 'single') {
        await apiFetch('/settings/assign-employee', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: form.employeeId,
            branchId: form.branchId,
            shiftId: form.shiftId,
            workScheduleId: form.workScheduleId,
          }),
        });
      } else {
        await apiFetch('/settings/bulk-assign', {
          method: 'POST',
          body: JSON.stringify({
            employeeIds: form.employeeIds,
            branchId: form.branchId,
            shiftId: form.shiftId,
            workScheduleId: form.workScheduleId,
          }),
        });
      }
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewHistory(employeeId, employeeName) {
    try {
      const data = await apiFetch(`/settings/assignments/employee/${employeeId}/history`);
      setHistory(data.history || []);
      setShowHistoryModal(employeeName);
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employee Assignments</h1>
          <p className="text-sm text-slate-500">Assign employees to branches, shifts, and work schedules</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openSingleAssign()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            <UserPlus className="w-4 h-4" /> Assign
          </button>
          <button
            onClick={openBulkAssign}
            className="inline-flex items-center gap-2 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50 transition"
          >
            <Users className="w-4 h-4" /> Bulk Assign
          </button>
        </div>
      </div>

      {/* Unassigned notice */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-700">
            <strong>{unassigned.length}</strong> employee(s) have no branch/shift assignment.
          </span>
          <button
            onClick={openBulkAssign}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline"
          >
            Assign now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <select
          value={filterShift}
          onChange={(e) => setFilterShift(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
        >
          <option value="">All Shifts</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Assignments table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Since</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((a) => (
                <tr key={a.employee?.id || a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{a.employee?.name}</p>
                    <p className="text-xs text-slate-500">{a.employee?.employeeCode} · {a.employee?.department}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {a.branch?.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {a.shift?.name}
                      <span className="text-xs text-slate-400">({a.shift?.startTime}–{a.shift?.endTime})</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {a.workSchedule?.name}
                      <span className="text-xs text-slate-400">({(a.workSchedule?.workingDays || []).length}d)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {a.effectiveFrom && formatDate(a.effectiveFrom, dateFormat)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openSingleAssign(a.employee?.id)}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded text-xs"
                        title="Reassign"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => viewHistory(a.employee?.id, a.employee?.name)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        title="History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No assignments match the current filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">
                {mode === 'bulk' ? 'Bulk Assign Employees' : 'Assign Employee'}
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="assign-form" onSubmit={handleAssign} className="flex-1 overflow-auto p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Employee selection */}
              {mode === 'single' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                  <select
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select employee...</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.employeeCode || e.email})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employees ({form.employeeIds.length} selected)
                  </label>
                  <div className="border border-slate-300 rounded-lg max-h-40 overflow-auto p-2 space-y-1">
                    {employees.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.employeeIds.includes(e.id)}
                          onChange={() => toggleBulkEmployee(e.id)}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700">{e.name}</span>
                        <span className="text-xs text-slate-400">{e.employeeCode}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Target selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shift *</label>
                <select
                  value={form.shiftId}
                  onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select shift...</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work Schedule *</label>
                <select
                  value={form.workScheduleId}
                  onChange={(e) => setForm({ ...form, workScheduleId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select schedule...</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({(s.workingDays || []).length}d)</option>
                  ))}
                </select>
              </div>
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button type="button" onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >Cancel</button>
              <button type="submit" form="assign-form" disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Assigning...' : mode === 'bulk' ? `Assign ${form.employeeIds.length} Employee(s)` : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Assignment History — {showHistoryModal}</h2>
              <button onClick={() => setShowHistoryModal(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No history found</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={h.id || i} className={`p-3 rounded-lg border ${h.isCurrent ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}>
                      {h.isCurrent && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium mb-2 inline-block">Current</span>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">Branch</p>
                          <p className="font-medium text-slate-700">{h.branch?.name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Shift</p>
                          <p className="font-medium text-slate-700">{h.shift?.name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Schedule</p>
                          <p className="font-medium text-slate-700">{h.workSchedule?.name || '—'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {h.effectiveFrom && formatDate(h.effectiveFrom, dateFormat)}
                        {h.effectiveTo && ` → ${formatDate(h.effectiveTo, dateFormat)}`}
                        {!h.effectiveTo && h.isCurrent && ' → present'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
