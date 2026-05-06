import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  FileText, Plus, Trash2, Edit3, X, Eye, Shield, DollarSign, TreePalm, BookOpen, Lock
} from 'lucide-react';

const CATEGORIES = [
  { value: 'LEAVE', label: 'Leave Policy', icon: TreePalm, color: 'emerald' },
  { value: 'SALARY', label: 'Salary Policy', icon: DollarSign, color: 'blue' },
  { value: 'PRIVACY', label: 'Privacy Policy', icon: Lock, color: 'purple' },
  { value: 'CODE_OF_CONDUCT', label: 'Code of Conduct', icon: Shield, color: 'amber' },
  { value: 'CUSTOM', label: 'Custom', icon: BookOpen, color: 'slate' },
];

function getCategoryConfig(category) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
}

export default function Policies() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadPolicies(); }, []);

  async function loadPolicies() {
    try {
      setLoading(true);
      const data = isAdmin ? await api.getAllPolicies() : await api.getPolicies();
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this policy?')) return;
    try {
      await api.deletePolicy(id);
      setPolicies(prev => prev.filter(p => p.id !== id));
      if (selectedPolicy?.id === id) setSelectedPolicy(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleEdit(policy) {
    setEditingPolicy(policy);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingPolicy(null);
    setShowForm(true);
  }

  const filteredPolicies = filterCategory
    ? policies.filter(p => p.category === filterCategory)
    : policies;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  // View single policy
  if (selectedPolicy) {
    const cat = getCategoryConfig(selectedPolicy.category);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPolicy(null)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            ← Back to Policies
          </button>
          {isAdmin && (
            <button
              onClick={() => handleEdit(selectedPolicy)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg bg-${cat.color}-50`}>
              <cat.icon size={20} className={`text-${cat.color}-600`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedPolicy.title}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${cat.color}-100 text-${cat.color}-700`}>
                {cat.label}
              </span>
            </div>
          </div>
          {!selectedPolicy.isActive && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              This policy is currently inactive and not visible to employees.
            </div>
          )}
          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {selectedPolicy.content}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
            {selectedPolicy.creator && <span>Created by {selectedPolicy.creator.name}</span>}
            <span>Updated {new Date(selectedPolicy.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
          <p className="text-sm text-slate-500 mt-1">Organization policies and guidelines</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus size={16} /> Add Policy
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            !filterCategory ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filterCategory === cat.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Policies Grid */}
      {filteredPolicies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No policies found</p>
          {isAdmin && (
            <button onClick={handleCreate} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
              Create your first policy
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPolicies.map(policy => {
            const cat = getCategoryConfig(policy.category);
            return (
              <div
                key={policy.id}
                className={`bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer relative ${
                  !policy.isActive ? 'opacity-60' : ''
                }`}
                onClick={() => setSelectedPolicy(policy)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-${cat.color}-50`}>
                    <cat.icon size={18} className={`text-${cat.color}-600`} />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleEdit(policy)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{policy.title}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${cat.color}-100 text-${cat.color}-700`}>
                  {cat.label}
                </span>
                <p className="text-xs text-slate-400 mt-3 line-clamp-2">
                  {policy.content.substring(0, 120)}...
                </p>
                {!policy.isActive && (
                  <span className="absolute top-3 right-3 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <PolicyForm
          policy={editingPolicy}
          onClose={() => { setShowForm(false); setEditingPolicy(null); }}
          onSaved={(saved) => {
            if (editingPolicy) {
              setPolicies(prev => prev.map(p => p.id === saved.id ? saved : p));
              if (selectedPolicy?.id === saved.id) setSelectedPolicy(saved);
            } else {
              setPolicies(prev => [saved, ...prev]);
            }
            setShowForm(false);
            setEditingPolicy(null);
          }}
        />
      )}
    </div>
  );
}

function PolicyForm({ policy, onClose, onSaved }) {
  const [title, setTitle] = useState(policy?.title || '');
  const [category, setCategory] = useState(policy?.category || 'LEAVE');
  const [content, setContent] = useState(policy?.content || '');
  const [isActive, setIsActive] = useState(policy?.isActive !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = { title: title.trim(), category, content: content.trim(), isActive };
      let result;
      if (policy) {
        result = await api.updatePolicy(policy.id, data);
      } else {
        result = await api.createPolicy(data);
      }
      onSaved(result.policy);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {policy ? 'Edit Policy' : 'Create Policy'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Leave Policy 2026"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={12}
              placeholder="Write your policy content here..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-sm text-slate-700">Active (visible to employees)</span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : policy ? 'Update Policy' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
