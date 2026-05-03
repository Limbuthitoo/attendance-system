import { useState, useEffect } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '../api';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const EMPTY_PLAN = {
  name: '', code: '', description: '',
  price: '', currency: 'NPR', billingCycle: 'monthly',
  maxEmployees: '', maxBranches: '', maxDevices: '',
  trialDays: 0, sortOrder: 0, isActive: true, features: [],
};

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      const data = await getPlans();
      setPlans(data.plans || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PLAN);
    setFeatureInput('');
    setShowModal(true);
  }

  function openEdit(plan) {
    setEditing(plan.id);
    setForm({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      maxEmployees: plan.maxEmployees,
      maxBranches: plan.maxBranches,
      maxDevices: plan.maxDevices,
      trialDays: plan.trialDays || 0,
      sortOrder: plan.sortOrder || 0,
      isActive: plan.isActive,
      features: plan.features || [],
    });
    setFeatureInput('');
    setShowModal(true);
  }

  function addFeature() {
    const f = featureInput.trim();
    if (f && !form.features.includes(f)) {
      setForm({ ...form, features: [...form.features, f] });
    }
    setFeatureInput('');
  }

  function removeFeature(idx) {
    setForm({ ...form, features: form.features.filter((_, i) => i !== idx) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        maxEmployees: Number(form.maxEmployees),
        maxBranches: Number(form.maxBranches),
        maxDevices: Number(form.maxDevices),
        trialDays: Number(form.trialDays),
        sortOrder: Number(form.sortOrder),
      };
      if (editing) {
        await updatePlan(editing, payload);
      } else {
        await createPlan(payload);
      }
      setShowModal(false);
      fetchPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan) {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      await deletePlan(plan.id);
      fetchPlans();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatPrice(price, currency) {
    return `${currency} ${(price / 100).toLocaleString()}`;
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading plans...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Manage pricing and limits for each plan</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm border p-5 flex flex-col ${
              !plan.isActive ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{plan.name}</h3>
                <span className="text-xs text-gray-400 font-mono">{plan.code}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(plan)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(plan)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(plan.price, plan.currency)}
              </span>
              <span className="text-sm text-gray-500">/{plan.billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
            </div>

            {plan.description && (
              <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
            )}

            <div className="text-sm text-gray-600 space-y-1 mb-3">
              <div>Up to <strong>{plan.maxEmployees}</strong> employees</div>
              <div>Up to <strong>{plan.maxBranches}</strong> branches</div>
              <div>Up to <strong>{plan.maxDevices}</strong> devices</div>
              {plan.trialDays > 0 && (
                <div><strong>{plan.trialDays}</strong>-day trial</div>
              )}
            </div>

            {plan.features?.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-0.5 mt-auto pt-3 border-t">
                {plan.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            )}

            <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
              <span className={plan.isActive ? 'text-green-600' : 'text-gray-400'}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
              {plan._count?.organizations > 0 && (
                <span className="text-gray-400">{plan._count.organizations} org(s)</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Plan' : 'Create Plan'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Starter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    placeholder="e.g. starter"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (paisa)</label>
                  <input
                    required type="number" min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  {form.price && (
                    <p className="text-xs text-gray-400 mt-0.5">= NPR {(Number(form.price) / 100).toLocaleString()}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="NPR">NPR</option>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Employees</label>
                  <input
                    required type="number" min="1"
                    value={form.maxEmployees}
                    onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Branches</label>
                  <input
                    required type="number" min="1"
                    value={form.maxBranches}
                    onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Devices</label>
                  <input
                    required type="number" min="1"
                    value={form.maxDevices}
                    onChange={(e) => setForm({ ...form, maxDevices: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
                  <input
                    type="number" min="0"
                    value={form.trialDays}
                    onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number" min="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="Add a feature…"
                  />
                  <button type="button" onClick={addFeature} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.features.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                      {f}
                      <button type="button" onClick={() => removeFeature(i)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  id="plan-active"
                  className="rounded"
                />
                <label htmlFor="plan-active" className="text-sm text-gray-700">Active</label>
              </div>

              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
