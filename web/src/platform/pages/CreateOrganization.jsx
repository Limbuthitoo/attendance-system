import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrganization, getPlans } from '../api';
import { ArrowLeft, Building2 } from 'lucide-react';

export default function CreateOrganization() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    domain: '',
    plan: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlans().then((data) => {
      const list = data.plans || data;
      setPlans(list);
      if (list.length && !form.plan) {
        setForm((prev) => ({ ...prev, plan: list[0].id }));
      }
    }).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from name
      if (field === 'name' && !prev.slug) {
        next.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name || !form.adminEmail || !form.adminPassword) {
      setError('Organization name, admin email, and admin password are required.');
      return;
    }
    if (form.adminPassword.length < 6) {
      setError('Admin password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      const result = await createOrganization(form);
      navigate(`/platform/organizations/${result.organization.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Organization</h1>
          <p className="text-sm text-gray-500">Set up a new tenant with an admin user</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Organization details */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            Organization Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Acme Corp"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="acme-corp"
              />
              <p className="text-xs text-gray-400 mt-1">URL-friendly identifier (auto-generated from name)</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain (optional)</label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="acme.com"
              />
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Subscription Plan</h2>
          <div className="grid grid-cols-1 gap-2">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.plan === plan.id
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={form.plan === plan.id}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-500">
                    {plan.price === 0
                      ? `${plan.maxEmployees} employees, ${plan.maxBranches} branches — ${plan.trialDays}-day free trial`
                      : `${plan.currency} ${(plan.price / 100).toLocaleString()}/mo — ${plan.maxEmployees} employees, ${plan.maxBranches} branches, ${plan.maxDevices} devices`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Admin user */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Organization Admin</h2>
          <p className="text-sm text-gray-500">This user will be the initial administrator.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
              <input
                type="text"
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Admin User"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="admin@acme.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
              <input
                type="password"
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Organization'}
          </button>
        </div>
      </form>
    </div>
  );
}
