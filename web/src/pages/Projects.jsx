import { useState, useEffect, useCallback } from 'react';
import { Plus, X, FolderKanban, Users, Calendar, Target, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';

const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS = {
  PLANNING: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-700',
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [employees, setEmployees] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        api.getProjects(),
        api.getEmployees?.().catch(() => ({ employees: [] })),
      ]);
      setProjects(p.projects || []);
      setEmployees(e.employees || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', budget: '', managerId: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createProject({ ...form, budget: form.budget ? Number(form.budget) : null, managerId: form.managerId || null });
      setShowForm(false); setForm({ name: '', description: '', startDate: '', endDate: '', budget: '', managerId: '' }); load();
    } catch (err) { alert(err.message); }
  }

  async function handleStatusChange(id, status) {
    try { await api.updateProject(id, { status }); load(); } catch (err) { alert(err.message); }
  }

  async function handleProgressChange(id, progress) {
    try { await api.updateProject(id, { progress: Number(progress) }); load(); } catch (err) { alert(err.message); }
  }

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'IN_PROGRESS').length,
    completed: projects.filter(p => p.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Project Management</h1><p className="text-sm text-gray-500 mt-1">Track projects, members, and progress</p></div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-xs text-gray-500">Total Projects</p></div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-600">{stats.active}</p><p className="text-xs text-gray-500">Active</p></div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.completed}</p><p className="text-xs text-gray-500">Completed</p></div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Project Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Manager</label>
              <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">None</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Budget (NPR)</label><input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">End Date</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Create Project</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{project.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {project.manager?.name || 'No manager'} · {project._count?.members || 0} members · {project._count?.tasks || 0} tasks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}>{project.status.replace(/_/g, ' ')}</span>
                  <select value={project.status} onChange={e => handleStatusChange(project.id, e.target.value)} className="text-xs px-2 py-1 border border-gray-200 rounded">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              {project.description && <p className="text-sm text-gray-600 mb-3">{project.description}</p>}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span><span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                <input type="range" min="0" max="100" step="5" value={project.progress} onChange={e => handleProgressChange(project.id, e.target.value)} className="w-24" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {project.startDate && <span><Calendar size={12} className="inline mr-1" />{new Date(project.startDate).toLocaleDateString()}</span>}
                {project.endDate && <span>— {new Date(project.endDate).toLocaleDateString()}</span>}
                {project.budget && <span>Budget: NPR {Number(project.budget).toLocaleString()}</span>}
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><FolderKanban size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No projects yet</p></div>}
        </div>
      )}
    </div>
  );
}
