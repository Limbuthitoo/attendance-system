import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Check, Users, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

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

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({ permissions: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [rolesData, permsData] = await Promise.all([
        apiFetch('/roles'),
        apiFetch('/roles/permissions'),
      ]);
      setRoles(rolesData.roles || []);
      setPermissions(permsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditRole(null);
    setForm({ name: '', description: '', permissions: [] });
    setError('');
    setShowForm(true);
  }

  function openEdit(role) {
    setEditRole(role);
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: [...(role.permissions || [])],
    });
    setError('');
    setShowForm(true);
  }

  function togglePermission(perm) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  function toggleGroup(group) {
    const groupPerms = permissions.grouped[group] || [];
    const allSelected = groupPerms.every((p) => form.permissions.includes(p));
    setForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !groupPerms.includes(p))
        : [...new Set([...prev.permissions, ...groupPerms])],
    }));
  }

  function toggleExpandGroup(group) {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name) { setError('Role name is required'); return; }
    if (form.permissions.length === 0) { setError('Select at least one permission'); return; }

    setSaving(true);
    setError('');
    try {
      if (editRole) {
        await apiFetch(`/roles/${editRole.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/roles', { method: 'POST', body: JSON.stringify(form) });
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/roles/${role.id}`, { method: 'DELETE' });
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
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Role Management</h1>
          <p className="text-sm text-slate-500">Define roles and assign permissions to control access</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {/* Role list */}
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${role.isSystem ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                  <Shield className={`w-5 h-5 ${role.isSystem ? 'text-amber-600' : 'text-indigo-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{role.name}</h3>
                    {role.isSystem && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">System</span>
                    )}
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      <Users className="w-3 h-3 inline mr-1" />
                      {role._count?.employeeRoles ?? 0} assigned
                    </span>
                  </div>
                  {role.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(role.permissions || []).slice(0, 6).map((p) => (
                      <span key={p} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                    {(role.permissions || []).length > 6 && (
                      <span className="text-xs text-slate-400">
                        +{role.permissions.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!role.isSystem && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(role)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(role)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {roles.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No roles found</p>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editRole ? 'Edit Role' : 'Create Role'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. branch_manager"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="What can this role do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Permissions ({form.permissions.length} selected)
                </label>
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 max-h-64 overflow-auto">
                  {Object.entries(permissions.grouped || {}).map(([group, perms]) => {
                    const allSelected = perms.every((p) => form.permissions.includes(p));
                    const someSelected = perms.some((p) => form.permissions.includes(p));
                    const expanded = expandedGroups[group] !== false;

                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandGroup(group)}
                            className="p-0.5"
                          >
                            {expanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            }
                          </button>
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleGroup(group)}
                              className="rounded text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium text-slate-700 capitalize">{group}</span>
                            <span className="text-xs text-slate-400">({perms.length})</span>
                          </label>
                        </div>
                        {expanded && (
                          <div className="ml-8 mt-1 space-y-1">
                            {perms.map((perm) => (
                              <label key={perm} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.permissions.includes(perm)}
                                  onChange={() => togglePermission(perm)}
                                  className="rounded text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-xs text-slate-600">{perm}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : editRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
