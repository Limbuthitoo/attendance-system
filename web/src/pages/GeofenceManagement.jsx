import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { MapPin, Navigation, Shield, Check, AlertTriangle, Pencil } from 'lucide-react';

function GeofenceCard({ branch, onEdit }) {
  const hasGeofence = branch.latitude && branch.longitude && branch.geofenceRadius;

  return (
    <div className={`bg-white rounded-xl border ${branch.geofenceEnabled ? 'border-green-200' : 'border-slate-200'} p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{branch.name}</h3>
          <p className="text-xs text-slate-500">{branch.code} {branch.city ? `· ${branch.city}` : ''}</p>
        </div>
        {branch.geofenceEnabled ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
            <Shield size={12} /> Enabled
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Disabled</span>
        )}
      </div>

      {hasGeofence ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Navigation size={14} className="text-slate-400" />
            <span>{Number(branch.latitude).toFixed(6)}, {Number(branch.longitude).toFixed(6)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin size={14} className="text-slate-400" />
            <span>{branch.geofenceRadius}m radius</span>
          </div>
          {branch.address && (
            <p className="text-xs text-slate-500 mt-1">{branch.address}</p>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          No geofence configured
        </div>
      )}

      <button onClick={() => onEdit(branch)}
        className="mt-4 text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
        <Pencil size={12} /> Configure
      </button>
    </div>
  );
}

function EditGeofenceModal({ branch, onClose, onSubmit }) {
  const [form, setForm] = useState({
    latitude: branch.latitude ? Number(branch.latitude) : '',
    longitude: branch.longitude ? Number(branch.longitude) : '',
    geofenceRadius: branch.geofenceRadius || 100,
    geofenceEnabled: branch.geofenceEnabled || false,
  });
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setDetecting(false);
      },
      (err) => { alert('Failed to get location: ' + err.message); setDetecting(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(branch.id, {
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        geofenceRadius: parseInt(form.geofenceRadius, 10),
        geofenceEnabled: form.geofenceEnabled,
      });
      onClose();
    } catch (err) { alert(err.message || 'Failed to update'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">Configure Geofence</h3>
        <p className="text-sm text-slate-500 mb-4">{branch.name} ({branch.code})</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
              <input type="number" step="0.0000001" value={form.latitude}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="27.7172453" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
              <input type="number" step="0.0000001" value={form.longitude}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="85.3239605" />
            </div>
          </div>

          <button type="button" onClick={detectLocation} disabled={detecting}
            className="w-full flex items-center justify-center gap-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Navigation size={14} />
            {detecting ? 'Detecting...' : 'Use Current Location'}
          </button>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Radius (meters)</label>
            <input type="number" min="10" max="5000" value={form.geofenceRadius}
              onChange={e => setForm(f => ({ ...f, geofenceRadius: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <p className="text-xs text-slate-500 mt-1">
              {form.geofenceRadius < 50 ? 'Very tight zone' :
               form.geofenceRadius < 150 ? 'Standard office area' :
               form.geofenceRadius < 500 ? 'Wide campus area' : 'Very large zone'}
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <input type="checkbox" checked={form.geofenceEnabled}
              onChange={e => setForm(f => ({ ...f, geofenceEnabled: e.target.checked }))}
              className="rounded" />
            <div>
              <span className="text-sm font-medium text-slate-700">Enable Geofencing</span>
              <p className="text-xs text-slate-500">Employees must be within the radius to check in from mobile</p>
            </div>
          </label>

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

export default function GeofenceManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editBranch, setEditBranch] = useState(null);

  const loadBranches = useCallback(async () => {
    try {
      const data = await api.getGeofences();
      setBranches(data.branches || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const handleUpdate = async (branchId, data) => {
    await api.updateGeofence(branchId, data);
    loadBranches();
  };

  const enabledCount = branches.filter(b => b.geofenceEnabled).length;
  const configuredCount = branches.filter(b => b.latitude && b.longitude).length;

  if (loading) return <div className="text-center py-16 text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Geofence Management</h1>
        <p className="text-sm text-slate-500 mt-1">Configure location boundaries for mobile check-in verification</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500">Total Branches</span>
          <p className="text-2xl font-bold mt-1">{branches.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500">Configured</span>
          <p className="text-2xl font-bold mt-1">{configuredCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-green-600">Active Fences</span>
          <p className="text-2xl font-bold mt-1 text-green-700">{enabledCount}</p>
        </div>
      </div>

      {/* Branch Grid */}
      {branches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No branches found</h3>
          <p className="text-sm text-slate-500 mt-1">Create branches first to configure geofences.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map(b => (
            <GeofenceCard key={b.id} branch={b} onEdit={setEditBranch} />
          ))}
        </div>
      )}

      {editBranch && (
        <EditGeofenceModal
          branch={editBranch}
          onClose={() => setEditBranch(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  );
}
