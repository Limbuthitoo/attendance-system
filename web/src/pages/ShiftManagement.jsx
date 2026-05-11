import { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, X, Check, AlertTriangle, Sun, Moon } from 'lucide-react';
import { request } from '../lib/api/client';

const apiFetch = (path, options = {}) => request(`/v1${path}`, options);

const DEFAULT_FORM = {
  name: '',
  branchId: '',
  startTime: '09:00',
  endTime: '18:00',
  lateThresholdMinutes: 30,
  halfDayHours: 4,
  fullDayHours: 8,
  minCheckoutMinutes: 2,
  isDefault: false,
};

export default function ShiftManagement() {
  const [shifts, setShifts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [shiftsData, branchesData] = await Promise.all([
        apiFetch('/settings/shifts'),
        apiFetch('/branches'),
      ]);
      setShifts(shiftsData.shifts || []);
      setBranches(branchesData.branches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditShift(null);
    setForm({ ...DEFAULT_FORM });
    setError('');
    setShowForm(true);
  }

  function openEdit(shift) {
    setEditShift(shift);
    setForm({
      name: shift.name,
      branchId: shift.branchId || '',
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateThresholdMinutes: shift.lateThresholdMinutes,
      halfDayHours: Number(shift.halfDayHours),
      fullDayHours: Number(shift.fullDayHours),
      minCheckoutMinutes: shift.minCheckoutMinutes,
      isDefault: shift.isDefault,
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.startTime || !form.endTime) {
      setError('Name, start time, and end time are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        branchId: form.branchId || null,
        lateThresholdMinutes: parseInt(form.lateThresholdMinutes),
        halfDayHours: parseFloat(form.halfDayHours),
        fullDayHours: parseFloat(form.fullDayHours),
        minCheckoutMinutes: parseInt(form.minCheckoutMinutes),
      };
      if (editShift) {
        await apiFetch(`/settings/shifts/${editShift.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/settings/shifts', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shift) {
    if (!window.confirm(`Deactivate shift "${shift.name}"?`)) return;
    try {
      await apiFetch(`/settings/shifts/${shift.id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatDuration(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shift Management</h1>
          <p className="text-sm text-slate-500">Define work shifts with timing rules for your organization</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Shift
        </button>
      </div>

      {/* Shift cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map((shift) => (
          <div key={shift.id} className="bg-white rounded-lg border border-slate-200 p-5 relative">
            {shift.isDefault && (
              <span className="absolute top-3 right-3 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                Default
              </span>
            )}

            <div className="flex items-start gap-4">
              <div className="bg-slate-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">{shift.name}</h3>
                {shift.branch && (
                  <p className="text-xs text-slate-500">{shift.branch.name} ({shift.branch.code})</p>
                )}

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-700 font-medium">{shift.startTime}</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-slate-700 font-medium">{shift.endTime}</span>
                  </div>
                  <span className="text-xs text-slate-400">({formatDuration(shift.startTime, shift.endTime)})</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                  <span>Late after: {shift.lateThresholdMinutes}min</span>
                  <span>Half-day: {Number(shift.halfDayHours)}h</span>
                  <span>Full-day: {Number(shift.fullDayHours)}h</span>
                  <span>Min checkout: {shift.minCheckoutMinutes}min</span>
                </div>

                {shift._count && (
                  <p className="text-xs text-slate-400 mt-2">
                    {shift._count.employeeAssignments} employee(s) assigned
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => openEdit(shift)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(shift)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Deactivate">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {shifts.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No shifts defined yet</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editShift ? 'Edit Shift' : 'Create Shift'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shift Name *</label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Morning Shift" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch (optional)</label>
                  <select
                    value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                  <input
                    type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Late Threshold (minutes)</label>
                  <input
                    type="number" min={0} value={form.lateThresholdMinutes}
                    onChange={(e) => setForm({ ...form, lateThresholdMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Checkout (minutes)</label>
                  <input
                    type="number" min={0} value={form.minCheckoutMinutes}
                    onChange={(e) => setForm({ ...form, minCheckoutMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Half-Day Hours</label>
                  <input
                    type="number" min={1} step={0.5} value={form.halfDayHours}
                    onChange={(e) => setForm({ ...form, halfDayHours: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full-Day Hours</label>
                  <input
                    type="number" min={1} step={0.5} value={form.fullDayHours}
                    onChange={(e) => setForm({ ...form, fullDayHours: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Set as default shift</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >Cancel</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {saving ? 'Saving...' : editShift ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
