import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Target, TrendingUp, Award, Calendar, Users, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';

const REVIEW_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-700',
};

export default function Performance() {
  const [tab, setTab] = useState('kpis');
  const [kpis, setKpis] = useState([]);
  const [scores, setScores] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, s, c, r] = await Promise.all([
        api.getKpis(), api.getScores({ year: filterYear, month: filterMonth }),
        api.getCycles({ year: filterYear }), api.getReviews(),
      ]);
      setKpis(k.kpis || []); setScores(s.scores || []); setCycles(c.cycles || []); setReviews(r.reviews || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filterYear, filterMonth]);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: 'kpis', label: 'KPI Definitions', icon: Target },
    { key: 'scores', label: 'Scores', icon: BarChart3 },
    { key: 'cycles', label: 'Review Cycles', icon: Calendar },
    { key: 'reviews', label: 'Reviews', icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Performance Management</h1><p className="text-sm text-gray-500 mt-1">KPIs, scorecards, and performance reviews</p></div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); }} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {tab === 'kpis' && <KpiTab kpis={kpis} onRefresh={load} showForm={showForm} setShowForm={setShowForm} />}
          {tab === 'scores' && <ScoresTab scores={scores} kpis={kpis} year={filterYear} month={filterMonth} setYear={setFilterYear} setMonth={setFilterMonth} onRefresh={load} />}
          {tab === 'cycles' && <CyclesTab cycles={cycles} onRefresh={load} showForm={showForm} setShowForm={setShowForm} />}
          {tab === 'reviews' && <ReviewsTab reviews={reviews} cycles={cycles} onRefresh={load} showForm={showForm} setShowForm={setShowForm} />}
        </>
      )}
    </div>
  );
}

function KpiTab({ kpis, onRefresh, showForm, setShowForm }) {
  const [form, setForm] = useState({ name: '', unit: 'number', targetValue: '', weight: '1', frequency: 'monthly', department: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try { await api.createKpi({ ...form, targetValue: Number(form.targetValue), weight: Number(form.weight) }); setShowForm(false); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{kpis.length} KPIs defined</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'Add KPI'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Sales Revenue" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="number">Number</option><option value="percentage">Percentage</option><option value="currency">Currency (NPR)</option><option value="boolean">Yes/No</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Target Value *</label><input type="number" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Weight</label><input type="number" step="0.1" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Department</label><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="All" /></div>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Create KPI</button>
        </form>
      )}

      <div className="space-y-3">
        {kpis.map(kpi => (
          <div key={kpi.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{kpi.name}</h3>
              <p className="text-xs text-gray-500">Target: {Number(kpi.targetValue).toLocaleString()} {kpi.unit} · Weight: {Number(kpi.weight)} · {kpi.frequency}{kpi.department ? ` · ${kpi.department}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{kpi._count?.scores || 0} scores</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kpi.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{kpi.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
        {kpis.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><Target size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No KPIs defined</p></div>}
      </div>
    </div>
  );
}

function ScoresTab({ scores, kpis, year, month, setYear, setMonth, onRefresh }) {
  const [form, setForm] = useState({ kpiId: '', employeeId: '', actualValue: '' });
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => { api.getEmployees?.().then(r => setEmployees(r.employees || [])).catch(() => {}); }, []);

  async function handleScore(e) {
    e.preventDefault();
    try { await api.upsertScore({ ...form, actualValue: Number(form.actualValue), year, month }); setShowForm(false); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">{Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{new Date(2000,i).toLocaleString('default',{month:'short'})}</option>)}</select>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'Record Score'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleScore} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">KPI *</label>
              <select value={form.kpiId} onChange={e => setForm({...form, kpiId: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select...</option>{kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
              <select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Actual Value *</label><input type="number" step="0.01" value={form.actualValue} onChange={e => setForm({...form, actualValue: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save Score</button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Employee</th><th className="px-4 py-3 text-left font-medium text-gray-600">KPI</th><th className="px-4 py-3 text-right font-medium text-gray-600">Target</th><th className="px-4 py-3 text-right font-medium text-gray-600">Actual</th><th className="px-4 py-3 text-right font-medium text-gray-600">Score</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {scores.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className="font-medium text-gray-900">{s.employee?.name}</span><span className="text-xs text-gray-500 block">{s.employee?.department}</span></td>
                <td className="px-4 py-3 text-gray-600">{s.kpi?.name}</td>
                <td className="px-4 py-3 text-right text-gray-600">{Number(s.kpi?.targetValue).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(s.actualValue).toLocaleString()}</td>
                <td className="px-4 py-3 text-right"><span className={`font-semibold ${Number(s.score) >= 80 ? 'text-emerald-600' : Number(s.score) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{Number(s.score).toFixed(1)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {scores.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No scores recorded for this period</div>}
      </div>
    </div>
  );
}

function CyclesTab({ cycles, onRefresh, showForm, setShowForm }) {
  const [form, setForm] = useState({ name: '', year: new Date().getFullYear(), startDate: '', endDate: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try { await api.createCycle(form); setShowForm(false); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{cycles.length} review cycles</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Cancel' : 'New Cycle'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Q2 2026 Review" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Year</label><input type="number" value={form.year} onChange={e => setForm({...form, year: Number(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Create Cycle</button>
        </form>
      )}

      <div className="space-y-3">
        {cycles.map(c => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div><h3 className="font-semibold text-gray-900">{c.name}</h3><p className="text-xs text-gray-500">{c.year} · {new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}</p></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{c._count?.reviews || 0} reviews</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        ))}
        {cycles.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><Calendar size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No review cycles</p></div>}
      </div>
    </div>
  );
}

function ReviewsTab({ reviews, cycles, onRefresh, showForm, setShowForm }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{reviews.length} performance reviews</p>
      </div>

      <div className="space-y-3">
        {reviews.map(r => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{r.employee?.name}</h3>
              <p className="text-xs text-gray-500">{r.employee?.department} · {r.employee?.designation} · {r.cycle?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {r.overallScore && <span className="text-lg font-bold text-blue-600">{Number(r.overallScore).toFixed(1)}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        ))}
        {reviews.length === 0 && <div className="text-center py-12 bg-white border border-gray-200 rounded-xl"><Award size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No reviews yet</p></div>}
      </div>
    </div>
  );
}
