import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getOrganization, updateOrganization, suspendOrganization,
  reactivateOrganization, setOrgModules, getModules, getOrgBranches, getPlans,
} from '../api';
import {
  ArrowLeft, Building2, Users, Cpu, MapPin, Boxes,
  Save, Power, PowerOff,
} from 'lucide-react';

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [allModules, setAllModules] = useState([]);
  const [plans, setPlans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('overview');

  // Edit state
  const [form, setForm] = useState({});
  const [enabledModuleCodes, setEnabledModuleCodes] = useState([]);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [orgData, modulesData, branchesData, plansData] = await Promise.all([
        getOrganization(id),
        getModules(),
        getOrgBranches(id),
        getPlans(),
      ]);
      const o = orgData.organization;
      setOrg(o);
      setForm({
        name: o.name,
        domain: o.domain || '',
        planId: o.planId || '',
        maxEmployees: o.maxEmployees,
        maxBranches: o.maxBranches,
        maxDevices: o.maxDevices,
      });
      setEnabledModuleCodes(o.enabledModules?.map((m) => m.code) || []);
      setAllModules(modulesData.modules || []);
      setPlans(plansData.plans || plansData);
      setBranches(branchesData.branches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOrganization(id, form);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveModules() {
    setSaving(true);
    try {
      await setOrgModules(id, enabledModuleCodes);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    const action = org.isActive ? 'suspend' : 'reactivate';
    if (!window.confirm(`${action} "${org.name}"?`)) return;
    try {
      if (org.isActive) await suspendOrganization(id);
      else await reactivateOrganization(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleModule(code) {
    setEnabledModuleCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-48 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Organization not found.</p>
        <Link to="/platform/organizations" className="text-indigo-600 hover:underline mt-2 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'modules', label: 'Modules' },
    { id: 'branches', label: `Branches (${branches.length})` },
    { id: 'limits', label: 'Limits & Plan' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/platform/organizations')}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500">/{org.slug} {org.domain && `· ${org.domain}`}</p>
        </div>
        <button
          onClick={handleToggleStatus}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            org.isActive
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {org.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          {org.isActive ? 'Suspend' : 'Reactivate'}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} label="Employees" value={`${org.employeeCount} / ${org.maxEmployees}`} />
        <StatCard icon={MapPin} label="Branches" value={`${org.branchCount} / ${org.maxBranches}`} />
        <StatCard icon={Cpu} label="Devices" value={`${org.deviceCount} / ${org.maxDevices}`} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Domain" value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} placeholder="e.g. company.com" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Status:</span>
            <StatusBadge status={org.subscriptionStatus} />
            <span className="text-sm text-gray-500 ml-4">Plan:</span>
            <span className="text-sm font-medium">{org.plan?.name || 'No Plan'}</span>
          </div>
          {org.trialEndsAt && (
            <p className="text-sm text-gray-500">
              Trial ends: {new Date(org.trialEndsAt).toLocaleDateString()}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Created: {new Date(org.createdAt).toLocaleString()}
          </p>
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {tab === 'modules' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Enabled Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {allModules.map((mod) => {
              const enabled = enabledModuleCodes.includes(mod.code);
              return (
                <label
                  key={mod.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    enabled ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleModule(mod.code)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{mod.name}</p>
                    <p className="text-xs text-gray-500">{mod.code}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <button
            onClick={handleSaveModules}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Boxes className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Module Configuration'}
          </button>
        </div>
      )}

      {tab === 'branches' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Timezone</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{b.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{b.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{b.city || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{b.timezone}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No branches</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'limits' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Plan & Limits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No Plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.price ? ` — ${p.currency} ${(p.price / 100).toLocaleString()}/mo` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div />
            <NumberField label="Max Employees" value={form.maxEmployees} onChange={(v) => setForm({ ...form, maxEmployees: v })} />
            <NumberField label="Max Branches" value={form.maxBranches} onChange={(v) => setForm({ ...form, maxBranches: v })} />
            <NumberField label="Max Devices" value={form.maxDevices} onChange={(v) => setForm({ ...form, maxDevices: v })} />
          </div>
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
      <div className="bg-gray-100 p-2.5 rounded-lg">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE: 'bg-green-100 text-green-800',
    TRIAL: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
