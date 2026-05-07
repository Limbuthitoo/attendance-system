import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Layers, Tag, Cpu, Edit2, Trash2, ChevronDown, ChevronUp,
  Activity, Wifi, WifiOff, AlertTriangle, Database, Settings2
} from 'lucide-react';

// ─── API helpers ────────────────────────────────────────────────────────────

const BASE = '/api/platform/device-catalog';

function getToken() {
  return localStorage.getItem('platform_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONNECTION_TYPES = [
  'LOCAL_USB', 'LOCAL_PCSC', 'LAN_TCP_IP', 'HTTP_API',
  'WEBHOOK', 'SDK', 'FILE_IMPORT', 'CLOUD_API',
];

const SYNC_MODES = [
  'PUSH', 'PULL', 'REALTIME', 'SCHEDULED', 'MANUAL_IMPORT', 'OFFLINE_SYNC',
];

const HEALTH_COLORS = {
  ONLINE: 'bg-emerald-100 text-emerald-700',
  OFFLINE: 'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  ERROR: 'bg-red-100 text-red-700',
  DISABLED: 'bg-slate-100 text-slate-500',
  GATEWAY_OFFLINE: 'bg-orange-100 text-orange-700',
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DeviceCatalog() {
  const [tab, setTab] = useState('models'); // 'categories', 'brands', 'models', 'health'
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, brandRes, modelRes, healthRes] = await Promise.all([
        request('/categories'),
        request('/brands'),
        request('/models'),
        request('/health'),
      ]);
      setCategories(catRes.categories);
      setBrands(brandRes.brands);
      setModels(modelRes.models);
      setHealth(healthRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { key: 'models', label: 'Device Models', icon: Cpu, count: models.length },
    { key: 'categories', label: 'Categories', icon: Layers, count: categories.length },
    { key: 'brands', label: 'Brands', icon: Tag, count: brands.length },
    { key: 'health', label: 'Health Overview', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Device Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Manage device categories, brands, and models for the platform</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {tab === 'categories' && <CategoriesTab categories={categories} onRefresh={loadData} />}
          {tab === 'brands' && <BrandsTab brands={brands} onRefresh={loadData} />}
          {tab === 'models' && <ModelsTab models={models} categories={categories} brands={brands} onRefresh={loadData} />}
          {tab === 'health' && <HealthTab health={health} />}
        </>
      )}
    </div>
  );
}

// ─── Categories Tab ─────────────────────────────────────────────────────────

function CategoriesTab({ categories, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', icon: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await request('/categories', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ key: '', name: '', icon: '' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await request(`/categories/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggle(cat) {
    try {
      await request(`/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{categories.length} categories defined</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Key *</label>
              <input
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value })}
                placeholder="NFC_RFID"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name *</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="NFC / RFID"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Icon (lucide name)</label>
              <input
                value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })}
                placeholder="credit-card"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Category'}
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Icon</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Models</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{cat.key}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500">{cat.icon || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{cat._count?.models || 0}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => handleToggle(cat)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    {cat.isActive ? 'Disable' : 'Enable'}
                  </button>
                  {cat._count?.models === 0 && (
                    <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Brands Tab ─────────────────────────────────────────────────────────────

function BrandsTab({ brands, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', website: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await request('/brands', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ name: '', website: '' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this brand?')) return;
    try {
      await request(`/brands/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{brands.length} brands registered</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Brand'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand Name *</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="ZKTeco"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.zkteco.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Brand'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                {brand.website && <a href={brand.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">{brand.website}</a>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${brand.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {brand.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{brand._count?.models || 0} models</span>
              {brand._count?.models === 0 && (
                <button onClick={() => handleDelete(brand.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Models Tab ─────────────────────────────────────────────────────────────

function ModelsTab({ models, categories, brands, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    categoryId: '', brandId: '', name: '', adapterKey: '',
    connectionType: 'LOCAL_PCSC', syncMode: 'PUSH', supportedActions: ['CHECK_IN', 'CHECK_OUT'],
  });
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.adapterKey) delete payload.adapterKey;
      await request('/models', { method: 'POST', body: JSON.stringify(payload) });
      setShowForm(false);
      setForm({ categoryId: '', brandId: '', name: '', adapterKey: '', connectionType: 'LOCAL_PCSC', syncMode: 'PUSH', supportedActions: ['CHECK_IN', 'CHECK_OUT'] });
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this model?')) return;
    try {
      await request(`/models/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggle(model) {
    try {
      await request(`/models/${model.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !model.isActive }),
      });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{models.length} device models configured</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Model'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select category</option>
                {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand *</label>
              <select value={form.brandId} onChange={e => setForm({ ...form, brandId: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select brand</option>
                {brands.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ACR122U" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Connection Type *</label>
              <select value={form.connectionType} onChange={e => setForm({ ...form, connectionType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {CONNECTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sync Mode</label>
              <select value={form.syncMode} onChange={e => setForm({ ...form, syncMode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {SYNC_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adapter Key</label>
              <input value={form.adapterKey} onChange={e => setForm({ ...form, adapterKey: e.target.value })} placeholder="Leave empty for regular devices" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Model'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {models.map(model => (
          <div key={model.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === model.id ? null : model.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Cpu size={20} className="text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{model.brand?.name} {model.name}</span>
                    {model.adapterKey && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-mono">{model.adapterKey}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {model.category?.name} · {model.connectionType.replace(/_/g, ' ')} · {model.syncMode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{model._count?.devices || 0} assigned</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${model.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {model.isActive ? 'Active' : 'Inactive'}
                </span>
                {expanded === model.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </div>

            {expanded === model.id && (
              <div className="px-5 pb-4 pt-2 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Capabilities</span>
                    <p className="font-medium text-gray-900 mt-0.5">{model.capabilities ? Object.entries(model.capabilities).filter(([,v]) => v).map(([k]) => k).join(', ') || 'None defined' : 'Not configured'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Supported Actions</span>
                    <p className="font-medium text-gray-900 mt-0.5">{model.supportedActions?.join(', ') || 'All'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Setup Schema</span>
                    <p className="font-medium text-gray-900 mt-0.5">{model.setupSchema ? 'Defined' : 'None'}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleToggle(model)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium">
                    {model.isActive ? 'Disable' : 'Enable'}
                  </button>
                  {model._count?.devices === 0 && (
                    <button onClick={() => handleDelete(model.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium">Delete</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {models.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <Cpu size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No device models configured yet</p>
            <p className="text-gray-400 text-xs mt-1">Create categories and brands first, then add models</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Health Tab ─────────────────────────────────────────────────────────────

function HealthTab({ health }) {
  if (!health) return <p className="text-gray-500 text-sm">Loading health data...</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{health.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Active Devices</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{health.byHealth?.ONLINE || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Online</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{health.byHealth?.WARNING || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Warning</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{(health.byHealth?.OFFLINE || 0) + (health.byHealth?.ERROR || 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Offline / Error</p>
        </div>
      </div>

      {/* By type */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Devices by Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(health.byType || {}).map(([type, count]) => (
            <div key={type} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{count}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">{type.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Health status breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Health Status Breakdown</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(health.byHealth || {}).map(([status, count]) => (
            <span key={status} className={`text-xs px-3 py-1.5 rounded-full font-medium ${HEALTH_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
