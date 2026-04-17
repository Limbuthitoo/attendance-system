import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import {
  Clock, Building2, Calendar, Timer, Save, RotateCcw, CheckCircle, Image, Upload, Trash2, Globe, Briefcase
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
  const [activeTab, setActiveTab] = useState('site');
  const [logoUrl, setLogoUrl] = useState(null);
  const [faviconUrl, setFaviconUrl] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(null); // { file, preview }
  const [pendingFavicon, setPendingFavicon] = useState(null); // { file, preview }
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

  useEffect(() => {
    fetchSettings();
    checkBranding();
  }, []);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (pendingLogo) URL.revokeObjectURL(pendingLogo.preview);
      if (pendingFavicon) URL.revokeObjectURL(pendingFavicon.preview);
    };
  }, [pendingLogo, pendingFavicon]);

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

  function checkBranding() {
    fetch(`${apiBase}/settings/branding/logo`).then(r => {
      if (r.ok) setLogoUrl(`${apiBase}/settings/branding/logo?t=${Date.now()}`);
      else setLogoUrl(null);
    }).catch(() => setLogoUrl(null));
    fetch(`${apiBase}/settings/branding/favicon`).then(r => {
      if (r.ok) setFaviconUrl(`${apiBase}/settings/branding/favicon?t=${Date.now()}`);
      else setFaviconUrl(null);
    }).catch(() => setFaviconUrl(null));
  }

  function selectFile(type, file) {
    const preview = URL.createObjectURL(file);
    if (type === 'logo') {
      if (pendingLogo) URL.revokeObjectURL(pendingLogo.preview);
      setPendingLogo({ file, preview });
      setRemoveLogo(false);
    } else {
      if (pendingFavicon) URL.revokeObjectURL(pendingFavicon.preview);
      setPendingFavicon({ file, preview });
      setRemoveFavicon(false);
    }
    setSaved(false);
  }

  function markRemove(type) {
    if (type === 'logo') {
      if (pendingLogo) URL.revokeObjectURL(pendingLogo.preview);
      setPendingLogo(null);
      setRemoveLogo(true);
    } else {
      if (pendingFavicon) URL.revokeObjectURL(pendingFavicon.preview);
      setPendingFavicon(null);
      setRemoveFavicon(true);
    }
    setSaved(false);
  }

  function undoRemove(type) {
    if (type === 'logo') setRemoveLogo(false);
    else setRemoveFavicon(false);
  }

  async function uploadFile(type, file) {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/settings/branding/${type}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
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

  const SITE_KEYS = ['company_name'];
  const OFFICE_KEYS = [
    'office_start', 'office_end', 'late_threshold_minutes',
    'half_day_hours', 'full_day_hours', 'min_checkout_minutes', 'working_days', 'timezone',
  ];

  async function saveSiteSettings() {
    setSaving(true);
    setError('');
    try {
      // Save company name
      const siteOnly = {};
      SITE_KEYS.forEach(k => { if (settings[k] !== undefined) siteOnly[k] = settings[k]; });
      const data = await api._request('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: siteOnly }),
      });
      setSettings(data.settings);
      setOriginal(data.settings);

      // Handle logo: upload pending or remove
      let logoDetail = undefined;
      if (pendingLogo) {
        await uploadFile('logo', pendingLogo.file);
        URL.revokeObjectURL(pendingLogo.preview);
        setPendingLogo(null);
        const newLogoUrl = `${apiBase}/settings/branding/logo?t=${Date.now()}`;
        setLogoUrl(newLogoUrl);
        logoDetail = newLogoUrl;
      } else if (removeLogo) {
        await api._request('/settings/branding/logo', { method: 'DELETE' });
        setLogoUrl(null);
        setRemoveLogo(false);
        logoDetail = null;
      }

      // Handle favicon: upload pending or remove
      let faviconDetail = undefined;
      if (pendingFavicon) {
        await uploadFile('favicon', pendingFavicon.file);
        URL.revokeObjectURL(pendingFavicon.preview);
        setPendingFavicon(null);
        const newFaviconUrl = `${apiBase}/settings/branding/favicon?t=${Date.now()}`;
        setFaviconUrl(newFaviconUrl);
        faviconDetail = newFaviconUrl;
      } else if (removeFavicon) {
        await api._request('/settings/branding/favicon', { method: 'DELETE' });
        setFaviconUrl(null);
        setRemoveFavicon(false);
        faviconDetail = null;
      }

      // Dispatch single event with both logo and favicon updates
      if (logoDetail !== undefined || faviconDetail !== undefined) {
        window.dispatchEvent(new CustomEvent('branding-updated', {
          detail: { logo: logoDetail, favicon: faviconDetail }
        }));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveOfficeSettings() {
    setSaving(true);
    setError('');
    try {
      const officeOnly = {};
      OFFICE_KEYS.forEach(k => { if (settings[k] !== undefined) officeOnly[k] = settings[k]; });
      const data = await api._request('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: officeOnly }),
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

  const siteHasChanges = SITE_KEYS.some(k => settings?.[k] !== original?.[k]) || !!pendingLogo || !!pendingFavicon || removeLogo || removeFavicon;
  const officeHasChanges = OFFICE_KEYS.some(k => settings?.[k] !== original?.[k]);
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
          <h1 className="text-2xl font-bold text-slate-900">General Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure company branding and office preferences</p>
        </div>
        {activeTab === 'office' && (
          <div className="flex items-center gap-2">
            {officeHasChanges && (
              <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                <RotateCcw size={16} /> Reset
              </button>
            )}
            <button
              onClick={saveOfficeSettings}
              disabled={!officeHasChanges || saving}
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
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('site')}
          className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'site'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe size={16} /> Site Settings
        </button>
        <button
          onClick={() => setActiveTab('office')}
          className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'office'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase size={16} /> Office Settings
        </button>
      </div>

      {/* ===== Site Settings Tab ===== */}
      {activeTab === 'site' && (
        <>
          {/* Company Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-50"><Building2 size={20} className="text-purple-600" /></div>
              <h2 className="text-lg font-semibold text-slate-900">Company</h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={settings?.company_name || ''}
                onChange={e => update('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Logo & Favicon */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-50"><Image size={20} className="text-indigo-600" /></div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Logo & Favicon</h2>
                <p className="text-xs text-slate-500">Changes apply after clicking Save below</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                <div className={`border-2 border-dashed rounded-lg p-4 text-center ${pendingLogo ? 'border-primary-300 bg-primary-50/30' : removeLogo ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                  {removeLogo ? (
                    <div className="space-y-2">
                      <p className="text-sm text-red-500 font-medium">Marked for removal</p>
                      <button onClick={() => undoRemove('logo')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Undo</button>
                    </div>
                  ) : (pendingLogo || logoUrl) ? (
                    <div className="space-y-3">
                      <img src={pendingLogo ? pendingLogo.preview : logoUrl} alt="Logo" className="h-16 mx-auto object-contain" />
                      {pendingLogo && <p className="text-xs text-primary-600 font-medium">Pending — will apply on Save</p>}
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => logoInputRef.current?.click()} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                          {pendingLogo ? 'Change' : 'Replace'}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => markRemove('logo')} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => logoInputRef.current?.click()} className="space-y-2 w-full">
                      <Upload size={24} className="mx-auto text-slate-400" />
                      <p className="text-sm text-slate-500">Click to select logo</p>
                      <p className="text-xs text-slate-400">PNG, JPG, SVG or WebP (max 2MB)</p>
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                    onChange={e => { if (e.target.files[0]) selectFile('logo', e.target.files[0]); e.target.value = ''; }} />
                </div>
              </div>

              {/* Favicon */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Favicon</label>
                <div className={`border-2 border-dashed rounded-lg p-4 text-center ${pendingFavicon ? 'border-primary-300 bg-primary-50/30' : removeFavicon ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                  {removeFavicon ? (
                    <div className="space-y-2">
                      <p className="text-sm text-red-500 font-medium">Marked for removal</p>
                      <button onClick={() => undoRemove('favicon')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Undo</button>
                    </div>
                  ) : (pendingFavicon || faviconUrl) ? (
                    <div className="space-y-3">
                      <img src={pendingFavicon ? pendingFavicon.preview : faviconUrl} alt="Favicon" className="h-16 mx-auto object-contain" />
                      {pendingFavicon && <p className="text-xs text-primary-600 font-medium">Pending — will apply on Save</p>}
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => faviconInputRef.current?.click()} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                          {pendingFavicon ? 'Change' : 'Replace'}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => markRemove('favicon')} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => faviconInputRef.current?.click()} className="space-y-2 w-full">
                      <Upload size={24} className="mx-auto text-slate-400" />
                      <p className="text-sm text-slate-500">Click to select favicon</p>
                      <p className="text-xs text-slate-400">PNG, ICO, SVG or WebP (max 2MB)</p>
                    </button>
                  )}
                  <input ref={faviconInputRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp,image/vnd.microsoft.icon" className="hidden"
                    onChange={e => { if (e.target.files[0]) selectFile('favicon', e.target.files[0]); e.target.value = ''; }} />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSiteSettings}
              disabled={!siteHasChanges || saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : saved ? (
                <CheckCircle size={16} />
              ) : (
                <Save size={16} />
              )}
              {saved ? 'Saved!' : 'Save Site Settings'}
            </button>
          </div>
        </>
      )}

      {/* ===== Office Settings Tab ===== */}
      {activeTab === 'office' && (
        <>
          {/* Office Hours */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-50"><Clock size={20} className="text-blue-600" /></div>
              <h2 className="text-lg font-semibold text-slate-900">Office Hours</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                <select
                  value={settings?.timezone || 'Asia/Kathmandu'}
                  onChange={e => update('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Office timezone for attendance</p>
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
        </>
      )}
    </div>
  );
}
