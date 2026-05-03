import { useState, useEffect } from 'react';
import { getPlatformUsers, createPlatformUser, updatePlatformUser, deletePlatformUser } from '../api';
import { usePlatformAuth } from '../PlatformAuthContext';
import { Users, Plus, Pencil, Trash2, X, Shield, Headphones } from 'lucide-react';

export default function PlatformUsers() {
  const { user: currentUser } = usePlatformAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'PLATFORM_SUPPORT', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const data = await getPlatformUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'PLATFORM_SUPPORT', isActive: true });
    setError('');
    setShowModal(true);
  }

  function openEdit(user) {
    setEditing(user.id);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, isActive: user.isActive });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;

      if (editing) {
        await updatePlatformUser(editing, payload);
      } else {
        await createPlatformUser(payload);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (user.id === currentUser?.id) {
      alert("You can't delete your own account.");
      return;
    }
    if (!confirm(`Delete platform user "${user.name}"?`)) return;
    try {
      await deletePlatformUser(user.id);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggleActive(user) {
    if (user.id === currentUser?.id) {
      alert("You can't deactivate your own account.");
      return;
    }
    try {
      await updatePlatformUser(user.id, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  const roleConfig = {
    SUPER_ADMIN: { label: 'Super Admin', icon: Shield, color: 'bg-purple-100 text-purple-800' },
    PLATFORM_SUPPORT: { label: 'Support', icon: Headphones, color: 'bg-blue-100 text-blue-800' },
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admin and support accounts</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => {
              const role = roleConfig[u.role] || roleConfig.PLATFORM_SUPPORT;
              const RoleIcon = role.icon;
              const isMe = u.id === currentUser?.id;
              return (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {u.name} {isMe && <span className="text-xs text-indigo-500 ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                      <RoleIcon className="w-3 h-3" /> {role.label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={isMe}
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        u.isActive
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      } disabled:cursor-not-allowed`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!isMe && (
                        <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Edit User' : 'Add Platform User'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editing ? '(leave blank to keep)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editing}
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder={editing ? '••••••••' : 'Min 8 characters'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="SUPER_ADMIN">Super Admin — Full access</option>
                  <option value="PLATFORM_SUPPORT">Support — Read-only access</option>
                </select>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} id="user-active" className="rounded" />
                  <label htmlFor="user-active" className="text-sm text-gray-700">Active</label>
                </div>
              )}
              {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
