import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { formatDate as _fmtDate, formatDateTime as _fmtDateTime } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import {
  Wifi, WifiOff, Plus, RotateCw, Shield, Trash2, Eye, Copy, Check, AlertTriangle,
  Fingerprint, QrCode, ScanFace, CreditCard, MapPin, Clock, ChevronDown, ChevronUp,
  Radio, Activity, Settings2, RefreshCw
} from 'lucide-react';

const DEVICE_TYPES = [
  { value: 'NFC_READER', label: 'NFC Reader', icon: CreditCard, color: 'blue' },
  { value: 'QR_TERMINAL', label: 'QR Terminal', icon: QrCode, color: 'purple' },
  { value: 'FINGERPRINT', label: 'Fingerprint Scanner', icon: Fingerprint, color: 'green' },
  { value: 'FACE_RECOGNITION', label: 'Face Recognition', icon: ScanFace, color: 'orange' },
];

const CREDENTIAL_TYPES = [
  { value: 'NFC_CARD', label: 'NFC Card', icon: CreditCard },
  { value: 'FINGERPRINT', label: 'Fingerprint', icon: Fingerprint },
  { value: 'QR_CODE', label: 'QR Code', icon: QrCode },
  { value: 'FACE_ID', label: 'Face ID', icon: ScanFace },
  { value: 'PIN', label: 'PIN Code', icon: Shield },
];

const EVENT_TYPES = ['CHECK_IN', 'CHECK_OUT', 'REJECTED', 'UNKNOWN'];

function getDeviceTypeInfo(type) {
  return DEVICE_TYPES.find(d => d.value === type) || DEVICE_TYPES[0];
}

function getCredentialTypeInfo(type) {
  return CREDENTIAL_TYPES.find(c => c.value === type) || CREDENTIAL_TYPES[0];
}

function isOnline(lastHeartbeat) {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 60000; // 1 min
}

function timeAgo(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Tab Navigation ─────────────────────────────────────────────────────────

function Tabs({ active, onChange }) {
  const tabs = [
    { id: 'devices', label: 'Devices', icon: Radio },
    { id: 'credentials', label: 'Credentials', icon: Shield },
    { id: 'events', label: 'Event Log', icon: Activity },
  ];

  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Device Card ────────────────────────────────────────────────────────────

function DeviceCard({ device, onDeactivate, onReactivate, onRotateKey, onEdit }) {
  const { dateFormat } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const info = getDeviceTypeInfo(device.deviceType);
  const Icon = info.icon;
  const online = isOnline(device.lastHeartbeatAt);

  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <div className={`bg-white rounded-xl border ${device.isActive ? 'border-slate-200' : 'border-red-200 bg-red-50/30'} shadow-sm overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[info.color]}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{device.name || device.deviceSerial}</h3>
              <p className="text-xs text-slate-500 font-mono">{device.deviceSerial}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <Wifi size={12} /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                <WifiOff size={12} /> Offline
              </span>
            )}
            {!device.isActive && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">Deactivated</span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-slate-500 text-xs">Type</span>
            <p className="font-medium">{info.label}</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Branch</span>
            <p className="font-medium">{device.branch?.name || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Last Heartbeat</span>
            <p className="font-medium">{timeAgo(device.lastHeartbeatAt)}</p>
          </div>
        </div>

        {device.location && (
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} />
            {device.location}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Actions
        </button>
        <span className="text-xs text-slate-400">
          Added {_fmtDate(device.createdAt, dateFormat)}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-3 flex flex-wrap gap-2">
          <button
            onClick={() => onEdit(device)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"
          >
            <Settings2 size={12} /> Edit
          </button>
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

// ─── Register Device Modal ──────────────────────────────────────────────────

function RegisterDeviceModal({ branches, onClose, onSubmit }) {
  const [form, setForm] = useState({ deviceType: 'NFC_READER', deviceSerial: '', name: '', location: '', branchId: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await onSubmit(form);
      setResult(data);
    } catch (err) {
      alert(err.message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(result.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Device Registered</h3>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Save this API key now</p>
                <p className="mt-1">This key will not be shown again. Store it securely.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm break-all flex items-center gap-2">
            <code className="flex-1">{result.apiKey}</code>
            <button onClick={copyKey} className="flex-shrink-0 p-1.5 rounded hover:bg-slate-200">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-slate-500" />}
            </button>
          </div>

          <button onClick={onClose} className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Register New Device</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Device Type</label>
            <div className="grid grid-cols-2 gap-2">
              {DEVICE_TYPES.map(dt => {
                const DtIcon = dt.icon;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, deviceType: dt.value }))}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                      form.deviceType === dt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <DtIcon size={18} />
                    {dt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number / MAC</label>
            <input
              required
              value={form.deviceSerial}
              onChange={e => setForm(f => ({ ...f, deviceSerial: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. ACR122U-001 or AA:BB:CC:DD:EE:FF"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Device Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Main Entrance Reader"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No branch (organization-wide)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Ground Floor, Front Desk"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.deviceSerial} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Device Modal ──────────────────────────────────────────────────────

function EditDeviceModal({ device, branches, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: device.name || '', location: device.location || '', branchId: device.branch?.id || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(device.id, form);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to update device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Edit Device</h3>
        <p className="text-sm text-slate-500 mb-4 font-mono">{device.deviceSerial}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Device Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign Credential Modal ────────────────────────────────────────────────

function AssignCredentialModal({ employees, onClose, onSubmit }) {
  const [form, setForm] = useState({ employeeId: '', credentialType: 'NFC_CARD', credentialData: '', label: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to assign credential');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Assign Credential</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <select
              required
              value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id || emp.employeeId})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Credential Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CREDENTIAL_TYPES.filter(c => c.value !== 'QR_CODE').map(ct => {
                const CtIcon = ct.icon;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, credentialType: ct.value }))}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.credentialType === ct.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <CtIcon size={16} />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {form.credentialType === 'NFC_CARD' ? 'Card UID' :
               form.credentialType === 'FINGERPRINT' ? 'Template ID' :
               form.credentialType === 'FACE_ID' ? 'Enrollment ID' :
               form.credentialType === 'PIN' ? 'PIN Code' : 'Credential Data'}
            </label>
            <input
              required
              value={form.credentialData}
              onChange={e => setForm(f => ({ ...f, credentialData: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              placeholder={
                form.credentialType === 'NFC_CARD' ? 'e.g. A1B2C3D4' :
                form.credentialType === 'FINGERPRINT' ? 'e.g. FP-001-TEMPLATE-HASH' :
                form.credentialType === 'FACE_ID' ? 'e.g. FACE-001-ENROLL-ID' :
                form.credentialType === 'PIN' ? 'e.g. 1234' : 'Enter credential data'
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label (optional)</label>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Primary badge, Left thumb"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading || !form.employeeId || !form.credentialData} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── API Key Display Modal ──────────────────────────────────────────────────

function ApiKeyModal({ apiKey, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">New API Key Generated</p>
              <p className="mt-1">Save this key now — it will not be shown again.</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm break-all flex items-center gap-2">
          <code className="flex-1">{apiKey}</code>
          <button onClick={copyKey} className="flex-shrink-0 p-1.5 rounded hover:bg-slate-200">
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-slate-500" />}
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">Done</button>
      </div>
    </div>
  );
}

// ─── Credential Row ─────────────────────────────────────────────────────────

function CredentialRow({ credential, onDeactivate }) {
  const { dateFormat } = useSettings();
  const info = getCredentialTypeInfo(credential.credentialType);
  const CredIcon = info.icon;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <CredIcon size={16} className="text-slate-400" />
          <span className="font-medium text-sm">{info.label}</span>
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-xs text-slate-600 max-w-[180px] truncate">
        {credential.credentialData}
      </td>
      <td className="py-3 px-4 text-sm">{credential.employee?.name || '—'}</td>
      <td className="py-3 px-4 text-xs text-slate-500 font-mono">{credential.employee?.employeeId || credential.employee?.employee_id || '—'}</td>
      <td className="py-3 px-4 text-sm">{credential.label || '—'}</td>
      <td className="py-3 px-4">
        {credential.isActive ? (
          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
        ) : (
          <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Inactive</span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-slate-500">{_fmtDate(credential.assignedAt, dateFormat)}</td>
      <td className="py-3 px-4">
        {credential.isActive && (
          <button
            onClick={() => onDeactivate(credential)}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Deactivate
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Event Row ──────────────────────────────────────────────────────────────

function EventRow({ event }) {
  const { dateFormat } = useSettings();
  const eventColors = {
    CHECK_IN: 'text-green-700 bg-green-50',
    CHECK_OUT: 'text-blue-700 bg-blue-50',
    REJECTED: 'text-red-700 bg-red-50',
    UNKNOWN: 'text-slate-700 bg-slate-100',
  };

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
      <td className="py-3 px-4 text-xs text-slate-500">
        {_fmtDateTime(event.eventTime, dateFormat)}
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${eventColors[event.eventType] || eventColors.UNKNOWN}`}>
          {event.eventType}
        </span>
      </td>
      <td className="py-3 px-4 text-sm">{event.employee?.name || '—'}</td>
      <td className="py-3 px-4 text-sm">{event.device?.name || event.device?.deviceSerial || '—'}</td>
      <td className="py-3 px-4 text-xs text-slate-500">{event.credentialType || '—'}</td>
      <td className="py-3 px-4 text-xs text-slate-500">{event.result}</td>
      <td className="py-3 px-4 text-sm">{event.branch?.name || '—'}</td>
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DeviceManagement() {
  const [tab, setTab] = useState('devices');
  const [devices, setDevices] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [events, setEvents] = useState({ events: [], pagination: {} });
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [deviceFilter, setDeviceFilter] = useState({ branchId: '', deviceType: '' });
  const [credFilter, setCredFilter] = useState({ employeeId: '', credentialType: '' });
  const [eventFilter, setEventFilter] = useState({ deviceId: '', eventType: '', page: 1 });

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [showAssignCred, setShowAssignCred] = useState(false);
  const [rotatedKey, setRotatedKey] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await api.getDevices(deviceFilter.branchId, deviceFilter.deviceType);
      setDevices(data.devices || []);
    } catch { /* ignore */ }
  }, [deviceFilter]);

  const loadCredentials = useCallback(async () => {
    try {
      const data = await api.getCredentials(credFilter.employeeId, credFilter.credentialType);
      setCredentials(data.credentials || []);
    } catch { /* ignore */ }
  }, [credFilter]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await api.getDeviceEvents({ ...eventFilter });
      setEvents(data);
    } catch { /* ignore */ }
  }, [eventFilter]);

  const loadBranches = useCallback(async () => {
    try {
      const data = await api.getBranches();
      setBranches(data.branches || []);
    } catch { /* ignore */ }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.getEmployees();
      setEmployees(data.employees || data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadBranches(), loadEmployees()]).then(() => setLoading(false));
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);
  useEffect(() => { if (tab === 'credentials') loadCredentials(); }, [tab, loadCredentials]);
  useEffect(() => { if (tab === 'events') loadEvents(); }, [tab, loadEvents]);

  const handleRegister = async (form) => {
    const data = await api.registerDevice(form);
    loadDevices();
    return data;
  };

  const handleDeactivateDevice = async (device) => {
    if (!confirm(`Deactivate "${device.name || device.deviceSerial}"?`)) return;
    await api.deactivateDevice(device.id);
    loadDevices();
  };

  const handleReactivateDevice = async (device) => {
    await api.reactivateDevice(device.id);
    loadDevices();
  };

  const handleRotateKey = async (device) => {
    if (!confirm(`Rotate API key for "${device.name || device.deviceSerial}"? The old key will stop working immediately.`)) return;
    const data = await api.rotateDeviceKey(device.id);
    setRotatedKey(data.apiKey);
  };

  const handleEditDevice = async (id, form) => {
    await api.updateDevice(id, form);
    loadDevices();
  };

  const handleAssignCredential = async (form) => {
    await api.assignCredential(form);
    loadCredentials();
  };

  const handleDeactivateCredential = async (cred) => {
    if (!confirm('Deactivate this credential?')) return;
    await api.deactivateCredential(cred.id);
    loadCredentials();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Device Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage attendance devices, credentials, and events</p>
        </div>
        <div className="flex gap-2">
          {tab === 'credentials' && (
            <button
              onClick={() => setShowAssignCred(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              <Plus size={16} /> Assign Credential
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs active={tab} onChange={setTab} />

      {/* Device Stats */}
      {tab === 'devices' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEVICE_TYPES.map(dt => {
              const count = devices.filter(d => d.deviceType === dt.value && d.isActive).length;
              const online = devices.filter(d => d.deviceType === dt.value && d.isActive && isOnline(d.lastHeartbeatAt)).length;
              const DtIcon = dt.icon;
              return (
                <div key={dt.value} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <DtIcon size={18} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{dt.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{count}</span>
                    <span className="text-xs text-green-600">{online} online</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={deviceFilter.branchId}
              onChange={e => setDeviceFilter(f => ({ ...f, branchId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              value={deviceFilter.deviceType}
              onChange={e => setDeviceFilter(f => ({ ...f, deviceType: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              {DEVICE_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
            </select>
          </div>

          {/* Device Grid */}
          {devices.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <Radio size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No devices assigned</h3>
              <p className="text-sm text-slate-500 mt-1">Contact your platform administrator to assign devices to your organization.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {devices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onDeactivate={handleDeactivateDevice}
                  onReactivate={handleReactivateDevice}
                  onRotateKey={handleRotateKey}
                  onEdit={setEditDevice}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Credentials Tab */}
      {tab === 'credentials' && (
        <>
          <div className="flex gap-3">
            <select
              value={credFilter.employeeId}
              onChange={e => setCredFilter(f => ({ ...f, employeeId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <select
              value={credFilter.credentialType}
              onChange={e => setCredFilter(f => ({ ...f, credentialType: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              {CREDENTIAL_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {credentials.length === 0 ? (
              <div className="text-center py-16">
                <Shield size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">No credentials assigned</h3>
                <p className="text-sm text-slate-500 mt-1">Assign NFC cards, fingerprint templates, or face IDs to employees.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Credential</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Emp ID</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Label</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Assigned</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(cred => (
                      <CredentialRow key={cred.id} credential={cred} onDeactivate={handleDeactivateCredential} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Event Log Tab */}
      {tab === 'events' && (
        <>
          <div className="flex gap-3 flex-wrap">
            <select
              value={eventFilter.deviceId}
              onChange={e => setEventFilter(f => ({ ...f, deviceId: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Devices</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name || d.deviceSerial}</option>)}
            </select>
            <select
              value={eventFilter.eventType}
              onChange={e => setEventFilter(f => ({ ...f, eventType: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All Events</option>
              {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
            <button
              onClick={loadEvents}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {(!events.events || events.events.length === 0) ? (
              <div className="text-center py-16">
                <Activity size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">No events recorded</h3>
                <p className="text-sm text-slate-500 mt-1">Device events will appear here when devices report check-ins.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Time</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Event</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Device</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Credential</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Result</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Branch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.events.map(event => (
                        <EventRow key={event.id} event={event} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {events.pagination && events.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                      Page {events.pagination.page} of {events.pagination.totalPages} ({events.pagination.total} events)
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={events.pagination.page <= 1}
                        onClick={() => setEventFilter(f => ({ ...f, page: f.page - 1 }))}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <button
                        disabled={events.pagination.page >= events.pagination.totalPages}
                        onClick={() => setEventFilter(f => ({ ...f, page: f.page + 1 }))}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          branches={branches}
          onClose={() => setEditDevice(null)}
          onSubmit={handleEditDevice}
        />
      )}
      {showAssignCred && (
        <AssignCredentialModal
          employees={employees}
          onClose={() => setShowAssignCred(false)}
          onSubmit={handleAssignCredential}
        />
      )}
      {rotatedKey && (
        <ApiKeyModal
          apiKey={rotatedKey}
          onClose={() => setRotatedKey(null)}
        />
      )}
    </div>
  );
}
