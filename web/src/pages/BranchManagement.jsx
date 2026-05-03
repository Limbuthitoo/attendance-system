import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Plus, Edit2, X, Check, AlertTriangle } from 'lucide-react';

const API_BASE = '/api/v1';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function BranchManagement() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', timezone: 'Asia/Kathmandu' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadBranches(); }, []);

  async function loadBranches() {
    try {
      const data = await apiFetch('/branches');
      setBranches(data.branches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditBranch(null);
    setForm({ name: '', code: '', address: '', city: '', timezone: 'Asia/Kathmandu' });
    setError('');
    setShowForm(true);
  }

  function openEdit(branch) {
    setEditBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      timezone: branch.timezone || 'Asia/Kathmandu',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.code) {
      setError('Name and code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editBranch) {
        await apiFetch(`/branches/${editBranch.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/branches', { method: 'POST', body: JSON.stringify(form) });
      }
      setShowForm(false);
      loadBranches();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(branch) {
    if (!window.confirm(`Deactivate branch "${branch.name}"?`)) return;
    try {
      await apiFetch(`/branches/${branch.id}`, { method: 'DELETE' });
      loadBranches();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Management</h1>
          <p className="text-sm text-slate-500">Manage your organization's branches and locations</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Branch
        </button>
      </div>

      {/* Branch list */}
      <div className="space-y-3">
        {branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-2.5 rounded-lg">
                  <MapPin className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{branch.name}</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{branch.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {branch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[branch.city, branch.timezone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(branch)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {branch.isActive && (
                  <button
                    onClick={() => handleDeactivate(branch)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Deactivate"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No branches found</p>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editBranch ? 'Edit Branch' : 'Add Branch'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Main Office"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="HQ"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Kathmandu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Asia/Kathmandu">Asia/Kathmandu (NPT +05:45)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving...' : editBranch ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
