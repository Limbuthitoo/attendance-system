import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  CreditCard, Wifi, WifiOff, Clock, UserPlus, Trash2, Ban,
  CheckCircle, AlertCircle, RefreshCw, Radio, Search, Plus,
  XCircle, Loader2, ChevronLeft, ChevronRight, PenTool, X
} from 'lucide-react';

// ─── Tab constants ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'cards', label: 'NFC Cards', icon: CreditCard },
  { id: 'taplog', label: 'Tap Log', icon: Clock },
  { id: 'readers', label: 'Reader Status', icon: Radio },
  { id: 'writejobs', label: 'Write Jobs', icon: PenTool },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(date).toLocaleDateString();
}

function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Assign Card Modal ──────────────────────────────────────────────────────

function AssignCardModal({ employees, onClose, onSubmit }) {
  const [form, setForm] = useState({ employee_id: '', card_uid: '', label: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Assign NFC Card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              value={form.employee_id}
              onChange={e => setForm({ ...form, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Select employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Card UID *</label>
            <input
              value={form.card_uid}
              onChange={e => setForm({ ...form, card_uid: e.target.value.toUpperCase() })}
              placeholder="e.g. A1B2C3D4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Tap the card on a reader to see its UID in the tap log, or use Write Job to auto-provision.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Office card, Spare"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              type="submit"
              disabled={loading || !form.employee_id || !form.card_uid}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Write Job Modal ────────────────────────────────────────────────────────

function WriteJobModal({ employees, onClose, onSubmit }) {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ employee_id: employeeId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Provision NFC Card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Select an employee and place a blank NFC card on the reader. The reader will write the employee's code to the card and auto-register it.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Select employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              type="submit"
              disabled={loading || !employeeId}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Write Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Cards Tab ──────────────────────────────────────────────────────────────

function CardsTab() {
  const [cards, setCards] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const [cardData, empData] = await Promise.all([
        api.getNfcCards(),
        api.getEmployees(),
      ]);
      setCards(cardData.cards || []);
      setEmployees(empData.employees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function handleAssign(form) {
    try {
      await api.assignNfcCard(form);
      setShowAssign(false);
      fetchCards();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivate(card) {
    if (!confirm(`Deactivate card ${card.card_uid} assigned to ${card.name}?`)) return;
    try {
      await api.deactivateNfcCard(card.id);
      fetchCards();
    } catch (err) { setError(err.message); }
  }

  async function handleActivate(card) {
    try {
      await api.activateNfcCard(card.id);
      fetchCards();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(card) {
    if (!confirm(`Permanently remove card ${card.card_uid}? This cannot be undone.`)) return;
    try {
      await api.deleteNfcCard(card.id);
      fetchCards();
    } catch (err) { setError(err.message); }
  }

  const filtered = cards.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.name, c.emp_code, c.card_uid, c.department, c.label]
      .filter(Boolean).some(v => v.toLowerCase().includes(q));
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => setShowAssign(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> Assign Card
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

      {filtered.length === 0 ? (
        <EmptyState icon={CreditCard} message={cards.length === 0 ? 'No NFC cards assigned yet' : 'No cards match your search'} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Card UID</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(card => (
                <tr key={card.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{card.card_uid}</td>
                  <td className="px-4 py-3 font-medium">{card.name}</td>
                  <td className="px-4 py-3 text-gray-500">{card.department || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{card.label || '—'}</td>
                  <td className="px-4 py-3">
                    {card.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                        <Ban size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(card.assigned_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {card.is_active ? (
                        <button onClick={() => handleDeactivate(card)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Deactivate">
                          <Ban size={14} />
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(card)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Activate">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(card)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAssign && (
        <AssignCardModal employees={employees} onClose={() => setShowAssign(false)} onSubmit={handleAssign} />
      )}
    </div>
  );
}

// ─── Tap Log Tab ────────────────────────────────────────────────────────────

function TapLogTab() {
  const [logs, setLogs] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNfcTapLog(date);
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  function changeDate(delta) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  }

  const resultColors = {
    CHECK_IN: 'text-green-700 bg-green-50',
    CHECK_OUT: 'text-blue-700 bg-blue-50',
    unknown_credential: 'text-amber-700 bg-amber-50',
    inactive_employee: 'text-red-700 bg-red-50',
    wrong_organization: 'text-red-700 bg-red-50',
    already_completed: 'text-gray-700 bg-gray-100',
  };

  const resultLabels = {
    CHECK_IN: 'Check In',
    CHECK_OUT: 'Check Out',
    unknown_credential: 'Unknown Card',
    inactive_employee: 'Inactive',
    wrong_organization: 'Wrong Org',
    already_completed: 'Already Done',
  };

  if (loading && logs.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
        <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Refresh">
          <RefreshCw size={16} />
        </button>
        <span className="text-xs text-gray-400 ml-auto">Auto-refreshes every 10s</span>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

      {logs.length === 0 ? (
        <EmptyState icon={Clock} message="No taps recorded for this date" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Card UID</th>
                <th className="px-4 py-3 text-left">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{formatTime(log.tap_time)}</td>
                  <td className="px-4 py-3">
                    {log.name ? (
                      <div>
                        <span className="font-medium">{log.name}</span>
                        <span className="text-gray-400 text-xs ml-2">{log.emp_code}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.card_uid}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${resultColors[log.result] || 'text-gray-700 bg-gray-100'}`}>
                      {resultLabels[log.result] || log.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reader Status Tab ──────────────────────────────────────────────────────

function ReaderStatusTab() {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReaders = useCallback(async () => {
    try {
      const data = await api.getReaderStatus();
      setReaders(data.readers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReaders(); }, [fetchReaders]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(fetchReaders, 5000);
    return () => clearInterval(interval);
  }, [fetchReaders]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {readers.some(r => r.online)
            ? <span className="text-green-600 font-medium">Readers connected</span>
            : <span className="text-amber-600 font-medium">No readers online</span>
          }
        </p>
        <span className="text-xs text-gray-400">Auto-refreshes every 5s</span>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

      {readers.length === 0 ? (
        <EmptyState icon={Radio} message="No NFC readers registered for this organization" subtext="Register an NFC reader device in Platform Admin, then configure it with the API key." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {readers.map(reader => (
            <div key={reader.device_id} className={`bg-white rounded-xl border p-5 ${reader.online ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Radio size={20} className={reader.online ? 'text-green-600' : 'text-gray-400'} />
                  <h3 className="font-semibold text-gray-900">{reader.name || reader.device_id}</h3>
                </div>
                {reader.online ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    <Wifi size={12} /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    <WifiOff size={12} /> Offline
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <p>Serial: <span className="font-mono text-xs">{reader.device_id}</span></p>
                <p>Last seen: {timeAgo(reader.last_seen)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Write Jobs Tab ─────────────────────────────────────────────────────────

function WriteJobsTab() {
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const [jobData, empData] = await Promise.all([
        api.getWriteJobs(),
        api.getEmployees(),
      ]);
      setJobs(jobData.jobs || []);
      setEmployees(empData.employees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh for pending jobs
  useEffect(() => {
    if (jobs.some(j => j.status === 'PENDING')) {
      const interval = setInterval(fetchJobs, 3000);
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  async function handleCreate(form) {
    try {
      await api.createWriteJob(form);
      setShowCreate(false);
      fetchJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(job) {
    if (!confirm('Cancel this write job?')) return;
    try {
      await api.cancelWriteJob(job.id);
      fetchJobs();
    } catch (err) { setError(err.message); }
  }

  const statusColors = {
    PENDING: 'text-amber-700 bg-amber-50',
    COMPLETED: 'text-green-700 bg-green-50',
    FAILED: 'text-red-700 bg-red-50',
    CANCELLED: 'text-gray-500 bg-gray-100',
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {jobs.filter(j => j.status === 'PENDING').length > 0
            ? <span className="text-amber-600 font-medium">Waiting for card placement...</span>
            : 'No pending write jobs'
          }
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> New Write Job
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

      {jobs.length === 0 ? (
        <EmptyState icon={PenTool} message="No write jobs yet" subtext="Create a write job to provision an NFC card for an employee." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Device</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Result</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{job.employee?.name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{job.dataToWrite}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{job.device?.name || job.device?.deviceSerial || 'Any'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[job.status] || ''}`}>
                      {job.status === 'PENDING' && <Loader2 size={12} className="animate-spin" />}
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {job.resultData ? <span className="font-mono">{job.resultData}</span> : job.errorMessage || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {job.status === 'PENDING' && (
                      <button onClick={() => handleCancel(job)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancel">
                        <XCircle size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <WriteJobModal employees={employees} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}

function EmptyState({ icon: Icon, message, subtext }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <Icon size={48} className="mx-auto mb-4 text-gray-300" />
      <p className="font-medium">{message}</p>
      {subtext && <p className="text-sm mt-1">{subtext}</p>}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function NfcManagement() {
  const [activeTab, setActiveTab] = useState('cards');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">NFC Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage NFC cards, view tap logs, and monitor readers</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 border-b-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'cards' && <CardsTab />}
      {activeTab === 'taplog' && <TapLogTab />}
      {activeTab === 'readers' && <ReaderStatusTab />}
      {activeTab === 'writejobs' && <WriteJobsTab />}
    </div>
  );
}
