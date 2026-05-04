import { useState, useEffect, useCallback } from 'react';
import {
  Wifi, WifiOff, Plus, RotateCw, Trash2, Copy, Check,
  Fingerprint, QrCode, ScanFace, CreditCard, MapPin, Clock,
  ChevronDown, ChevronUp, Radio, Activity, Settings2, RefreshCw,
  Building2, Search, Filter
} from 'lucide-react';

const DEVICE_TYPES = [
  { value: 'NFC_READER', label: 'NFC Reader', icon: CreditCard, color: 'blue' },
  { value: 'QR_TERMINAL', label: 'QR Terminal', icon: QrCode, color: 'purple' },
  { value: 'FINGERPRINT', label: 'Fingerprint Scanner', icon: Fingerprint, color: 'green' },
  { value: 'FACE_RECOGNITION', label: 'Face Recognition', icon: ScanFace, color: 'orange' },
];

function getDeviceTypeInfo(type) {
  return DEVICE_TYPES.find(d => d.value === type) || DEVICE_TYPES[0];
}

function isOnline(lastHeartbeat) {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 60000;
}

function timeAgo(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
  green: 'bg-green-50 text-green-700',
  orange: 'bg-orange-50 text-orange-700',
};

// ─── API helpers (platform endpoints) ───────────────────────────────────────

const BASE = '/api/platform';

function getToken() {
  return localStorage.getItem('platform_token');
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!options.isFormData) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ─── Register Device Modal ──────────────────────────────────────────────────

function RegisterDeviceModal({ organizations, onClose, onSubmit }) {
  const [form, setForm] = useState({
    orgId: '', deviceType: 'FINGERPRINT', deviceSerial: '', name: '', brand: '', model: '', location: '',
  });
  const [loading, setLoading] = useState(false);

  const selectedOrg = organizations.find(o => o.id === form.orgId);
  const branches = selectedOrg?.branches || [];

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ ...form, branchId: form.branchId || undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Register New Device</h2>
          <p className="text-sm text-gray-500 mt-1">Assign a device to an organization</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
            <select
              value={form.orgId}
              onChange={e => setForm({ ...form, orgId: e.target.value, branchId: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Select organization</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type *</label>
              <select
                value={form.deviceType}
                onChange={e => setForm({ ...form, deviceType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {DEVICE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
              <input
                value={form.deviceSerial}
                onChange={e => setForm({ ...form, deviceSerial: e.target.value })}
                placeholder="e.g. FP-2024-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. ZKTeco"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. MB460"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Main Entrance Fingerprint"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={form.branchId || ''}
                onChange={e => setForm({ ...form, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Ground floor entrance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.orgId || !form.deviceSerial}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── API Key Modal ──────────────────────────────────────────────────────────

function ApiKeyModal({ apiKey, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Device API Key</h2>
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
            Save this key now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
            <code className="flex-1 text-sm font-mono break-all">{apiKey}</code>
            <button onClick={handleCopy} className="text-gray-500 hover:text-gray-700 shrink-0">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
          <div className="mt-4 text-right">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Device Card ────────────────────────────────────────────────────────────

function DeviceCard({ device, onDeactivate, onReactivate, onRotateKey }) {
  const [expanded, setExpanded] = useState(false);
  const info = getDeviceTypeInfo(device.deviceType);
  const Icon = info.icon;
  const online = isOnline(device.lastHeartbeatAt);

  return (
    <div className={`bg-white rounded-xl border ${device.isActive ? 'border-gray-200' : 'border-red-200 bg-red-50/30'} shadow-sm overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[info.color]}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{device.name || device.deviceSerial}</h3>
              <p className="text-xs text-gray-500 font-mono">{device.deviceSerial}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <Wifi size={12} /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                <WifiOff size={12} /> Offline
              </span>
            )}
            {!device.isActive && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">Deactivated</span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Organization</span>
            <p className="font-medium flex items-center gap-1"><Building2 size={12} className="text-gray-400" /> {device.organization?.name || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Type</span>
            <p className="font-medium">{info.label}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Brand / Model</span>
            <p className="font-medium">{[device.brand, device.model].filter(Boolean).join(' ') || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Last Heartbeat</span>
            <p className="font-medium">{timeAgo(device.lastHeartbeatAt)}</p>
          </div>
        </div>

        {(device.branch?.name || device.location) && (
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
            {device.branch?.name && <span className="flex items-center gap-1"><Building2 size={12} />{device.branch.name}</span>}
            {device.location && <span className="flex items-center gap-1"><MapPin size={12} />{device.location}</span>}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Actions
        </button>
        <span className="text-xs text-gray-400">Added {new Date(device.createdAt).toLocaleDateString()}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2">
          <button
            onClick={() => onRotateKey(device)}
            className="text-xs px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1"
          >
            <RotateCw size={12} /> Rotate Key
          </button>
          {device.isActive ? (
            <button
              onClick={() => onDeactivate(device)}
              className="text-xs px-3 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
            >
              <Trash2 size={12} /> Deactivate
            </button>
          ) : (
            <button
              onClick={() => onReactivate(device)}
              className="text-xs px-3 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PlatformDevices() {
  const [devices, setDevices] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [apiKeyModal, setApiKeyModal] = useState(null);
  const [filterOrg, setFilterOrg] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [devData, orgData] = await Promise.all([
        request('/devices'),
        request('/organizations?limit=200'),
      ]);
      setDevices(devData.devices || []);
      setOrganizations(orgData.organizations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRegister(form) {
    try {
      const data = await request('/devices', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowRegister(false);
      if (data.apiKey) setApiKeyModal(data.apiKey);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivate(device) {
    if (!confirm(`Deactivate "${device.name || device.deviceSerial}"?`)) return;
    try {
      await request(`/devices/${device.id}/deactivate`, { method: 'PUT' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReactivate(device) {
    try {
      await request(`/devices/${device.id}/reactivate`, { method: 'PUT' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRotateKey(device) {
    if (!confirm(`Rotate API key for "${device.name || device.deviceSerial}"? The old key will stop working immediately.`)) return;
    try {
      const data = await request(`/devices/${device.id}/rotate-key`, { method: 'POST' });
      if (data.apiKey) setApiKeyModal(data.apiKey);
    } catch (err) {
      setError(err.message);
    }
  }

  // Filtered devices
  const filtered = devices.filter(d => {
    if (filterOrg && d.orgId !== filterOrg) return false;
    if (filterType && d.deviceType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches = [d.name, d.deviceSerial, d.brand, d.model, d.location, d.organization?.name]
        .filter(Boolean).some(v => v.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  const stats = {
    total: devices.length,
    active: devices.filter(d => d.isActive).length,
    online: devices.filter(d => isOnline(d.lastHeartbeatAt)).length,
    orgs: new Set(devices.map(d => d.orgId)).size,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage devices across all organizations</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} />
          Register Device
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Devices', value: stats.total, color: 'text-gray-900' },
          { label: 'Active', value: stats.active, color: 'text-green-600' },
          { label: 'Online Now', value: stats.online, color: 'text-blue-600' },
          { label: 'Organizations', value: stats.orgs, color: 'text-indigo-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, serial, brand..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Organizations</option>
          {organizations.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Types</option>
          {DEVICE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Radio size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="font-medium">{devices.length === 0 ? 'No devices registered yet' : 'No devices match your filters'}</p>
          <p className="text-sm mt-1">
            {devices.length === 0
              ? 'Register a device and assign it to an organization to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
              onRotateKey={handleRotateKey}
            />
          ))}
        </div>
      )}

      {showRegister && (
        <RegisterDeviceModal
          organizations={organizations}
          onClose={() => setShowRegister(false)}
          onSubmit={handleRegister}
        />
      )}

      {apiKeyModal && (
        <ApiKeyModal apiKey={apiKeyModal} onClose={() => setApiKeyModal(null)} />
      )}
    </div>
  );
}
