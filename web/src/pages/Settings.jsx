import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Clock, Building2, Calendar, Timer, Save, RotateCcw, CheckCircle
} from 'lucide-react';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const TIMEZONES = [
  'Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'America/New_York',
  'America/Los_Angeles', 'America/Chicago', 'Australia/Sydney', 'UTC',
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const data = await api._request('/settings');
      setSettings(data.settings);
      setOriginal(data.settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleDay(day) {
    const days = (settings.working_days || '').split(',').filter(Boolean);
    const idx = days.indexOf(day);
    if (idx >= 0) days.splice(idx, 1);
    else days.push(day);
    update('working_days', days.join(','));
  }

  function reset() {
    setSettings({ ...original });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const data = await api._request('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      setSettings(data.settings);
      setOriginal(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);
  const workingDays = (settings?.working_days || '').split(',').filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Office Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure office hours, late thresholds, and working days</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RotateCcw size={16} /> Reset
            </button>
          )}
          <button
            onClick={save}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : saved ? (
              <CheckCircle size={16} />
            ) : (
              <Save size={16} />
            )}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Company Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-50"><Building2 size={20} className="text-purple-600" /></div>
          <h2 className="text-lg font-semibold text-slate-900">Company</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={settings?.company_name || ''}
              onChange={e => update('company_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
            <select
              value={settings?.timezone || 'Asia/Kathmandu'}
              onChange={e => update('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Office Hours */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-50"><Clock size={20} className="text-blue-600" /></div>
          <h2 className="text-lg font-semibold text-slate-900">Office Hours</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Office Start Time</label>
            <input
              type="time"
              value={settings?.office_start || '09:00'}
              onChange={e => update('office_start', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Employees arriving after this time + grace period are marked late</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Office End Time</label>
            <input
              type="time"
              value={settings?.office_end || '18:00'}
              onChange={e => update('office_end', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Expected office closing time</p>
          </div>
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-50"><Timer size={20} className="text-orange-600" /></div>
          <h2 className="text-lg font-semibold text-slate-900">Thresholds</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Late Grace Period (minutes)</label>
            <input
              type="number"
              min="0"
              max="120"
              value={settings?.late_threshold_minutes || '30'}
              onChange={e => update('late_threshold_minutes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Minutes after start time before marked late</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Half-Day Threshold (hours)</label>
            <input
              type="number"
              min="1"
              max="12"
              step="0.5"
              value={settings?.half_day_hours || '4'}
              onChange={e => update('half_day_hours', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Less than this = half-day</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Day Hours</label>
            <input
              type="number"
              min="4"
              max="16"
              step="0.5"
              value={settings?.full_day_hours || '8'}
              onChange={e => update('full_day_hours', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Expected full work day hours</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Min. Checkout Delay (minutes)</label>
            <input
              type="number"
              min="0"
              max="30"
              value={settings?.min_checkout_minutes || '2'}
              onChange={e => update('min_checkout_minutes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Prevent accidental checkout within this time after check-in</p>
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-green-50"><Calendar size={20} className="text-green-600" /></div>
          <h2 className="text-lg font-semibold text-slate-900">Working Days</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day.key}
              onClick={() => toggleDay(day.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                workingDays.includes(day.key)
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Selected: {workingDays.length} days/week</p>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Configuration Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-900">{settings?.office_start}</p>
            <p className="text-xs text-slate-500">Start Time</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{settings?.office_end}</p>
            <p className="text-xs text-slate-500">End Time</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{settings?.late_threshold_minutes}m</p>
            <p className="text-xs text-slate-500">Grace Period</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{settings?.half_day_hours}h</p>
            <p className="text-xs text-slate-500">Half-Day Cutoff</p>
          </div>
        </div>
      </div>
    </div>
  );
}
