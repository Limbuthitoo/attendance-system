import { useState, useEffect, useCallback } from 'react';
import { Plus, X, UserPlus, ArrowRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import { api } from '../lib/api';

const STATUSES = ['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const STATUS_COLORS = {
  SUBMITTED: 'bg-gray-100 text-gray-700', SCREENING: 'bg-blue-100 text-blue-700',
  INTERVIEWING: 'bg-indigo-100 text-indigo-700', OFFERED: 'bg-amber-100 text-amber-700',
  HIRED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-red-100 text-red-700', WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('all'); // all | my

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = view === 'my' ? await api.getMyReferrals() : await api.getReferrals();
      setReferrals(r.referrals || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [view]);

  useEffect(() => { load(); }, [load]);

  const [form, setForm] = useState({ candidateName: '', candidateEmail: '', candidatePhone: '', position: '', notes: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try { await api.createReferral(form); setShowForm(false); setForm({ candidateName: '', candidateEmail: '', candidatePhone: '', position: '', notes: '' }); load(); } catch (err) { alert(err.message); }
  }

  async function handleStatusChange(id, status) {
    try { await api.updateReferral(id, { status }); load(); } catch (err) { alert(err.message); }
  }

  const stats = {
    total: referrals.length,
    active: referrals.filter(r => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(r.status)).length,
    hired: referrals.filter(r => r.status === 'HIRED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Referral Program</h1><p className="text-sm text-gray-500 mt-1">Refer candidates and track their progress</p></div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'Submit Referral'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-xs text-gray-500">Total Referrals</p></div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-600">{stats.active}</p><p className="text-xs text-gray-500">In Pipeline</p></div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.hired}</p><p className="text-xs text-gray-500">Hired</p></div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView('all')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All Referrals</button>
        <button onClick={() => setView('my')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>My Referrals</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Submit a Referral</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Candidate Name *</label><input value={form.candidateName} onChange={e => setForm({ ...form, candidateName: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.candidateEmail} onChange={e => setForm({ ...form, candidateEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input value={form.candidatePhone} onChange={e => setForm({ ...form, candidatePhone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Position *</label><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Submit Referral</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-3">
          {referrals.map(ref => (
            <div key={ref.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{ref.candidateName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ref.position} · Referred by {ref.referrer?.name || 'Unknown'}
                    {ref.candidateEmail && ` · ${ref.candidateEmail}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ref.bonusAmount && <span className="text-sm font-semibold text-emerald-600">NPR {Number(ref.bonusAmount).toLocaleString()}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ref.status]}`}>{ref.status}</span>
                  {!['HIRED', 'REJECTED', 'WITHDRAWN'].includes(ref.status) && (
                    <select value={ref.status} onChange={e => handleStatusChange(ref.id, e.target.value)} className="text-xs px-2 py-1 border border-gray-200 rounded">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {ref.notes && <p className="text-sm text-gray-600 mt-2">{ref.notes}</p>}
              <p className="text-xs text-gray-400 mt-2">Submitted {new Date(ref.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          {referrals.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><UserPlus size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No referrals yet</p></div>}
        </div>
      )}
    </div>
  );
}
