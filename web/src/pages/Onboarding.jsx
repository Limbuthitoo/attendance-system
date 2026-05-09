import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, CheckCircle2, Clock, UserPlus } from 'lucide-react';

export default function Onboarding() {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tasks: [] });

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'templates') { const d = await api.getTemplates(); setTemplates(d.templates || []); }
      else { const d = await api.getTasks({}); setTasks(d.tasks || []); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleCreateTemplate(e) {
    e.preventDefault();
    try {
      await api.createTemplate({
        name: form.name,
        department: form.department,
        tasks: form.tasks.filter(t => t.title),
      });
      setShowForm(false); setForm({ tasks: [] });
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleUpdateTask(taskId, status) {
    try {
      await api.updateTask(taskId, { status });
      loadData();
    } catch (err) { alert(err.message); }
  }

  function addTaskRow() {
    setForm({ ...form, tasks: [...form.tasks, { title: '', dayOffset: 0 }] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <button onClick={() => { setShowForm(true); setForm({ tasks: [{ title: '', dayOffset: 0 }] }); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> New Template
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: 'templates', label: 'Templates', icon: UserPlus }, { id: 'tasks', label: 'Active Tasks', icon: Clock }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'templates' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900">{t.name}</h3>
              <p className="text-sm text-gray-500">{t.department || 'All Departments'}</p>
              <p className="text-sm text-gray-400 mt-1">{t._count?.tasks || 0} tasks</p>
            </div>
          ))}
          {templates.length === 0 && <div className="col-span-full text-center py-8 text-gray-500 bg-white rounded-lg shadow">No onboarding templates</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {t.status === 'COMPLETED' ? <CheckCircle2 className="text-green-500" size={20} /> : <Clock className="text-yellow-500" size={20} />}
                <div>
                  <p className="font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.template?.name} · Day offset: {t.dayOffset}</p>
                </div>
              </div>
              {t.status !== 'COMPLETED' && (
                <button onClick={() => handleUpdateTask(t.id, 'COMPLETED')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Complete</button>
              )}
            </div>
          ))}
          {tasks.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">No active onboarding tasks</div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Onboarding Template</h2>
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <input placeholder="Template Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <input placeholder="Department (optional)" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full border rounded px-3 py-2" />
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tasks</label>
                {form.tasks.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input placeholder="Task title" value={t.title} onChange={e => { const tasks = [...form.tasks]; tasks[i].title = e.target.value; setForm({ ...form, tasks }); }} className="flex-1 border rounded px-3 py-2" />
                    <input type="number" placeholder="Day" value={t.dayOffset} onChange={e => { const tasks = [...form.tasks]; tasks[i].dayOffset = parseInt(e.target.value) || 0; setForm({ ...form, tasks }); }} className="w-20 border rounded px-3 py-2" />
                  </div>
                ))}
                <button type="button" onClick={addTaskRow} className="text-sm text-blue-600 hover:underline">+ Add task</button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
