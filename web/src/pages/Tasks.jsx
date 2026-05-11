import { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckSquare, Clock, AlertCircle, Tag, Calendar, User, FolderKanban } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUS_COLORS = {
  TODO: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700', DONE: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-700',
};
const PRIORITY_COLORS = {
  LOW: 'text-gray-400', MEDIUM: 'text-blue-500', HIGH: 'text-amber-500', URGENT: 'text-red-500',
};

export default function Tasks() {
  const { dateFormat } = useSettings();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const [t, e, p] = await Promise.all([
        api.getTasks(Object.keys(params).length ? params : undefined),
        api.getEmployees?.().catch(() => ({ employees: [] })),
        api.getProjects?.().catch(() => ({ projects: [] })),
      ]);
      setTasks(t.tasks || []);
      setEmployees(e.employees || []);
      setProjects(p.projects || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assignedTo: '', dueDate: '', projectId: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try { await api.createTask({ ...form, assignedTo: form.assignedTo || null, projectId: form.projectId || null }); setShowForm(false); setForm({ title: '', description: '', priority: 'MEDIUM', assignedTo: '', dueDate: '', projectId: '' }); load(); } catch (err) { alert(err.message); }
  }

  async function handleStatusChange(id, status) {
    try { await api.updateTask(id, { status }); load(); } catch (err) { alert(err.message); }
  }

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'TODO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    done: tasks.filter(t => t.status === 'DONE').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Task Management</h1><p className="text-sm text-gray-500 mt-1">Track and manage tasks across teams</p></div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-xs text-gray-500">Total</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-500">{stats.todo}</p><p className="text-xs text-gray-500">To Do</p></div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p><p className="text-xs text-gray-500">In Progress</p></div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.done}</p><p className="text-xs text-gray-500">Done</p></div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2 sm:col-span-1"><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
              <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Unassigned</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><DatePicker value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} placeholder="Due Date" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
              <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Create Task</button>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All Statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <button onClick={() => handleStatusChange(task.id, task.status === 'DONE' ? 'TODO' : 'DONE')} className={`mt-0.5 ${task.status === 'DONE' ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-400'}`}>
                    <CheckSquare size={20} />
                  </button>
                  <div>
                    <h3 className={`font-semibold ${task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {task.assignee && <span className="flex items-center gap-1"><User size={12} /> {task.assignee.name}</span>}
                      {task.project && <span className="flex items-center gap-1"><FolderKanban size={12} /> {task.project.name}</span>}
                      {task.dueDate && <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(task.dueDate, dateFormat)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className={PRIORITY_COLORS[task.priority]} title={task.priority} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>{task.status.replace(/_/g, ' ')}</span>
                  {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
                    <select value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)} className="text-xs px-2 py-1 border border-gray-200 rounded">
                      {STATUSES.filter(s => s !== 'CANCELLED').map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><CheckSquare size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No tasks yet</p></div>}
        </div>
      )}
    </div>
  );
}
