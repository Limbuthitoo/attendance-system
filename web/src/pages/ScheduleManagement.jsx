import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Edit2, Trash2, X, Check, AlertTriangle } from 'lucide-react';

const API_BASE = '/api/v1';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const ALL_DAYS = [
  { key: 'sun', label: 'Sun' },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
];

const PRESETS = [
  { label: '5-Day (Mon–Fri)', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: '6-Day (Mon–Sat)', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
  { label: '6-Day (Sun–Fri)', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'] },
];

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [form, setForm] = useState({ name: '', workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], effectiveFrom: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const data = await apiFetch('/settings/work-schedules');
      setSchedules(data.workSchedules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditSchedule(null);
    setForm({ name: '', workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], effectiveFrom: new Date().toISOString().split('T')[0] });
    setError('');
    setShowForm(true);
  }

  function openEdit(schedule) {
    setEditSchedule(schedule);
    setForm({
      name: schedule.name,
      workingDays: schedule.workingDays || [],
      effectiveFrom: schedule.effectiveFrom ? schedule.effectiveFrom.split('T')[0] : '',
    });
    setError('');
    setShowForm(true);
  }

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  }

  function applyPreset(days) {
    setForm((prev) => ({ ...prev, workingDays: [...days] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || form.workingDays.length === 0) {
      setError('Name and at least one working day are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editSchedule) {
        await apiFetch(`/settings/work-schedules/${editSchedule.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/settings/work-schedules', { method: 'POST', body: JSON.stringify(form) });
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(schedule) {
    if (!window.confirm(`Deactivate schedule "${schedule.name}"?`)) return;
    try {
      await apiFetch(`/settings/work-schedules/${schedule.id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          {[1, 2].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Work Schedules</h1>
          <p className="text-sm text-slate-500">Define 5-day, 6-day, or custom weekly schedules</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Schedule
        </button>
      </div>

      {/* Schedule list */}
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-lg">
                  <CalendarDays className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{schedule.name}</h3>
                  <div className="flex gap-1 mt-2">
                    {ALL_DAYS.map((d) => {
                      const active = (schedule.workingDays || []).includes(d.key);
                      return (
                        <span
                          key={d.key}
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium ${
                            active
                              ? 'bg-primary-100 text-primary-700 border border-primary-300'
                              : 'bg-slate-50 text-slate-300 border border-slate-200'
                          }`}
                        >
                          {d.label[0]}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{(schedule.workingDays || []).length} working days</span>
                    {schedule.effectiveFrom && (
                      <span>From: {new Date(schedule.effectiveFrom).toLocaleDateString()}</span>
                    )}
                    {schedule._count && (
                      <span>{schedule._count.employeeAssignments} employee(s)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(schedule)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(schedule)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Deactivate">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {schedules.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No work schedules defined yet</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editSchedule ? 'Edit Schedule' : 'Create Schedule'}</h2>
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Name *</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="5-Day Week" required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Presets</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label} type="button" onClick={() => applyPreset(p.days)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Working Days *</label>
                <div className="flex gap-2">
                  {ALL_DAYS.map((d) => {
                    const active = form.workingDays.includes(d.key);
                    return (
                      <button
                        key={d.key} type="button" onClick={() => toggleDay(d.key)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium border transition ${
                          active
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-slate-500 border-slate-300 hover:border-primary-400'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
                <input
                  type="date" value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >Cancel</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {saving ? 'Saving...' : editSchedule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
