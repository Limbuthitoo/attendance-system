import { useState, useEffect } from 'react';
import { Database, Save, RefreshCw, HardDrive, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

const API_BASE = '/api/platform';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('platform_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Global backup settings
  const [enabled, setEnabled] = useState(true);
  const [globalRetention, setGlobalRetention] = useState(30);
  const [frequency, setFrequency] = useState('daily');

  // Per-plan retention
  const [plans, setPlans] = useState([]);
  const [planSaving, setPlanSaving] = useState({});

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/settings/backup');
      setEnabled(data.enabled);
      setGlobalRetention(data.globalRetentionDays);
      setFrequency(data.frequency);
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveGlobalSettings() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await apiFetch('/settings/backup', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          globalRetentionDays: globalRetention,
          frequency,
        }),
      });
      setSuccess('Backup settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePlanRetention(planId, days) {
    try {
      setPlanSaving(prev => ({ ...prev, [planId]: true }));
      setError('');
      await apiFetch(`/settings/backup/plan/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({ retentionDays: days }),
      });
      setSuccess(`Plan retention updated to ${days} days`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlanSaving(prev => ({ ...prev, [planId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure global backup and data retention policies</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
      )}

      {/* Global Backup Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Backup Configuration</h2>
            <p className="text-sm text-gray-500">Global automated backup settings</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Automated Backups</p>
              <p className="text-sm text-gray-500">Enable or disable scheduled database backups</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                enabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Global Retention */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Global Retention Period</p>
              <p className="text-sm text-gray-500">Default number of days to keep backup files</p>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="1"
                max="365"
                value={globalRetention}
                onChange={(e) => setGlobalRetention(parseInt(e.target.value) || 1)}
                className="w-20 border rounded-lg px-3 py-2 text-sm text-right"
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </div>

          {/* Frequency */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Backup Frequency</p>
              <p className="text-sm text-gray-500">How often to create automated backups</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="hourly">Every Hour</option>
                <option value="6h">Every 6 Hours</option>
                <option value="12h">Every 12 Hours</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t flex justify-end">
          <button
            onClick={saveGlobalSettings}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Per-Plan Retention */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-purple-100 rounded-lg">
            <HardDrive className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Plan-Based Retention</h2>
            <p className="text-sm text-gray-500">
              Set backup retention days per subscription plan. Organizations inherit retention from their plan.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Retention (days)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.map((plan) => (
                <PlanRetentionRow
                  key={plan.id}
                  plan={plan}
                  saving={!!planSaving[plan.id]}
                  onSave={(days) => savePlanRetention(plan.id, days)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>How it works:</strong> Each organization's backup retention is determined by its subscription plan.
            Higher-tier plans get longer retention. The global retention setting above acts as the default for the backup cleanup script.
            Plan-specific retention values are shown on the Plans page and used for per-organization backup policies.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanRetentionRow({ plan, saving, onSave }) {
  const [days, setDays] = useState(plan.backupRetentionDays || 7);
  const changed = days !== (plan.backupRetentionDays || 7);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{plan.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{plan.code}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value) || 1)}
          className="w-20 border rounded-lg px-3 py-1.5 text-sm text-right"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onSave(days)}
          disabled={saving || !changed}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            changed
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
