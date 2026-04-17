import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import {
  Palette, Plus, Send, Trash2, CheckCircle, Clock, Loader, Calendar,
  Search, Filter, ChevronDown, X, Edit3, Bell, Users, AlertTriangle
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  completed: { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
};

const CATEGORY_CONFIG = {
  national: { label: 'National', color: 'text-red-600', bg: 'bg-red-50' },
  festival: { label: 'Festival', color: 'text-purple-600', bg: 'bg-purple-50' },
  religious: { label: 'Religious', color: 'text-amber-600', bg: 'bg-amber-50' },
  cultural: { label: 'Cultural', color: 'text-teal-600', bg: 'bg-teal-50' },
};

export default function DesignTasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bsYear, setBsYear] = useState(2083);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedDesigner, setSeedDesigner] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ event_name: '', event_date: '', category: 'festival', assigned_to: '', description: '' });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, [bsYear]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const data = await api._request(`/design-tasks?year=${bsYear}`);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployees() {
    try {
      const data = await api.getEmployees();
      setEmployees(data.employees || data || []);
    } catch {}
  }

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (search && !t.event_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    dated: tasks.filter(t => t.event_date).length,
    notified: tasks.filter(t => t.notification_sent).length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }), [tasks]);

  async function handleSeed() {
    try {
      await api._request('/design-tasks/seed', {
        method: 'POST',
        body: JSON.stringify({ bs_year: bsYear, assigned_to: seedDesigner || null }),
      });
      setSuccess(`Seeded ${bsYear} events successfully!`);
      setShowSeedModal(false);
      setSeedDesigner('');
      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleUpdate(id, updates) {
    try {
      const data = await api._request(`/design-tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data.task } : t));
      setEditingTask(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this design task?')) return;
    try {
      await api._request(`/design-tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleNotify(id) {
    setNotifying(true);
    try {
      const data = await api._request(`/design-tasks/${id}/notify`, {
        method: 'POST',
        body: JSON.stringify({ message: notifyMessage }),
      });
      setSuccess(data.message);
      setShowNotifyModal(null);
      setNotifyMessage('');
      fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setNotifying(false);
    }
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleBulkNotify() {
    if (selectedIds.size === 0) return;
    setNotifying(true);
    try {
      const data = await api._request('/design-tasks/notify-bulk', {
        method: 'POST',
        body: JSON.stringify({ task_ids: [...selectedIds], message: notifyMessage }),
      });
      setSuccess(data.message);
      setSelectedIds(new Set());
      setNotifyMessage('');
      fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setNotifying(false);
    }
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleStatusChange(id, status) {
    try {
      await api._request(`/design-tasks/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd() {
    try {
      await api._request('/design-tasks', {
        method: 'POST',
        body: JSON.stringify({ ...addForm, bs_year: bsYear, assigned_to: addForm.assigned_to || null }),
      });
      setShowAddModal(false);
      setAddForm({ event_name: '', event_date: '', category: 'festival', assigned_to: '', description: '' });
      fetchTasks();
      setSuccess('Task added!');
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleDeleteYear() {
    if (!confirm(`Delete ALL ${tasks.length} tasks for BS ${bsYear}? This cannot be undone.`)) return;
    try {
      await api._request(`/design-tasks/year/${bsYear}`, { method: 'DELETE' });
      setTasks([]);
      setSuccess(`All tasks for BS ${bsYear} deleted`);
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setSuccess(''), 4000);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return d;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette size={24} className="text-purple-600" /> Design Tasks
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage event designs and notify your designer</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={bsYear}
            onChange={e => setBsYear(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {[2081, 2082, 2083, 2084, 2085].map(y => (
              <option key={y} value={y}>BS {y}</option>
            ))}
          </select>
          {tasks.length === 0 ? (
            <button onClick={() => setShowSeedModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition">
              <Plus size={16} /> Seed Events
            </button>
          ) : (
            <>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition">
                <Plus size={16} /> Add
              </button>
              <button onClick={handleDeleteYear} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete all tasks for this year">
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Dates Set', value: stats.dated, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Notified', value: stats.notified, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg px-4 py-3 border border-slate-100`}>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + Bulk Actions */}
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">All Categories</option>
            <option value="national">National</option>
            <option value="festival">Festival</option>
            <option value="religious">Religious</option>
            <option value="cultural">Cultural</option>
          </select>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkNotify}
              disabled={notifying}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              <Send size={14} /> Notify {selectedIds.size} Selected
            </button>
          )}
        </div>
      )}

      {/* Task Table */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Palette size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No design tasks for BS {bsYear}</h3>
          <p className="text-sm text-slate-500 mt-1">Click "Seed Events" to populate all events for this year</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Event</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Assigned To</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Notified</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const days = daysUntil(task.event_date);
                  const sc = STATUS_CONFIG[task.status];
                  const cc = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.cultural;
                  const isEditing = editingTask?.id === task.id;

                  return (
                    <tr key={task.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition ${days !== null && days >= 0 && days <= 7 ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{task.event_name}</p>
                        {task.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{task.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="date"
                            defaultValue={task.event_date || ''}
                            onBlur={e => handleUpdate(task.id, { event_date: e.target.value || null })}
                            className="px-2 py-1 border border-slate-200 rounded text-sm w-36"
                            autoFocus
                          />
                        ) : task.event_date ? (
                          <div>
                            <p className="text-slate-700">{new Date(task.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            {days !== null && (
                              <p className={`text-xs ${days < 0 ? 'text-slate-400' : days <= 3 ? 'text-red-500 font-medium' : days <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                                {days > 0 ? `${days}d away` : days === 0 ? 'Today!' : `${Math.abs(days)}d ago`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No date</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cc.bg} ${cc.color}`}>
                          {cc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            defaultValue={task.assigned_to || ''}
                            onChange={e => handleUpdate(task.id, { assigned_to: e.target.value ? Number(e.target.value) : null })}
                            className="px-2 py-1 border border-slate-200 rounded text-sm"
                          >
                            <option value="">Unassigned</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={task.assigned_name ? 'text-slate-700' : 'text-slate-400 text-xs italic'}>
                            {task.assigned_name || 'Unassigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={e => handleStatusChange(task.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border} cursor-pointer`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {task.notification_sent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title={`Sent ${task.notification_date || ''}`}>
                            <CheckCircle size={14} /> Sent
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingTask(isEditing ? null : task)}
                            className={`p-1.5 rounded-lg transition ${isEditing ? 'bg-primary-100 text-primary-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          {task.assigned_to && (
                            <button
                              onClick={() => setShowNotifyModal(task)}
                              className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Send notification"
                            >
                              <Bell size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            Showing {filtered.length} of {tasks.length} events
          </div>
        </div>
      )}

      {/* Seed Modal */}
      {showSeedModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSeedModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Seed Design Events for BS {bsYear}</h3>
            <p className="text-sm text-slate-500">This will create 52 event tasks. You can assign dates and a designer afterwards.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign Designer (optional)</label>
              <select value={seedDesigner} onChange={e => setSeedDesigner(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">Assign later</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSeed} className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition">
                Create All Events
              </button>
              <button onClick={() => setShowSeedModal(false)} className="px-4 py-2 text-slate-600 text-sm font-medium bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNotifyModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Notify Designer</h3>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-medium text-slate-800">{showNotifyModal.event_name}</p>
              <p className="text-sm text-slate-500">To: {showNotifyModal.assigned_name}</p>
              {showNotifyModal.event_date && <p className="text-sm text-slate-500">Date: {new Date(showNotifyModal.event_date).toLocaleDateString()}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custom Message (optional)</label>
              <textarea
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                placeholder="E.g. Please prepare social media banners and stories..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleNotify(showNotifyModal.id)}
                disabled={notifying}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {notifying ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                Send Email
              </button>
              <button onClick={() => { setShowNotifyModal(null); setNotifyMessage(''); }} className="px-4 py-2 text-slate-600 text-sm font-medium bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Add Design Task</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Name *</label>
              <input
                type="text"
                value={addForm.event_name}
                onChange={e => setAddForm(p => ({ ...p, event_name: e.target.value }))}
                placeholder="e.g. Company Anniversary"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={addForm.event_date}
                  onChange={e => setAddForm(p => ({ ...p, event_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="festival">Festival</option>
                  <option value="national">National</option>
                  <option value="religious">Religious</option>
                  <option value="cultural">Cultural</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
              <select
                value={addForm.assigned_to}
                onChange={e => setAddForm(p => ({ ...p, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={addForm.description}
                onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Design requirements..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleAdd} disabled={!addForm.event_name} className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                Add Task
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600 text-sm font-medium bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
