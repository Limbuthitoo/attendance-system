import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Plus, Edit, Trash2, DollarSign, Calculator, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

// ── Tax Slab Editor ──────────────────────────────────────────────────────────
function TaxSlabEditor({ label, value, onChange }) {
  let slabs = [];
  try { slabs = typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : []); } catch { slabs = []; }

  const add = () => onChange([...slabs, { min: slabs.length ? slabs[slabs.length - 1].max : 0, max: 0, rate: 0 }]);
  const remove = (i) => onChange(slabs.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const updated = [...slabs];
    updated[i] = { ...updated[i], [field]: field === 'rate' ? parseFloat(val) || 0 : parseInt(val) || 0 };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={add} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Slab</button>
      </div>
      {slabs.length === 0 && <p className="text-xs text-gray-400 italic">No slabs defined — will use system fallback defaults</p>}
      {slabs.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="number" placeholder="Min" value={s.min || 0} onChange={e => update(i, 'min', e.target.value)} className="w-28 border rounded px-2 py-1.5 text-sm" />
          <span className="text-gray-400">→</span>
          <input type="number" placeholder="Max" value={s.max || 0} onChange={e => update(i, 'max', e.target.value)} className="w-28 border rounded px-2 py-1.5 text-sm" />
          <span className="text-gray-400">@</span>
          <input type="number" step="0.5" placeholder="Rate %" value={s.rate || 0} onChange={e => update(i, 'rate', e.target.value)} className="w-20 border rounded px-2 py-1.5 text-sm" />
          <span className="text-xs text-gray-500">%</span>
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export default function StatutoryCompliance() {
  const [tab, setTab] = useState('tax');
  const [configs, setConfigs] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'tax') {
        const data = await api.getTaxConfigs();
        setConfigs(data.configs || []);
      } else {
        const data = await api.getFestivalAdvances({});
        setAdvances(data.advances || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleSaveTax(e) {
    e.preventDefault();
    try {
      const payload = {
        fiscalYear: form.fiscalYear,
        ssfEmployeeRate: parseFloat(form.ssfEmployeeRate) || 0,
        ssfEmployerRate: parseFloat(form.ssfEmployerRate) || 0,
        citEmployeeRate: parseFloat(form.citEmployeeRate) || 0,
        citEmployerRate: parseFloat(form.citEmployerRate) || 0,
        pfEmployeeRate: parseFloat(form.pfEmployeeRate) || 0,
        pfEmployerRate: parseFloat(form.pfEmployerRate) || 0,
        taxSlabs: form.taxSlabs || [],
        marriedTaxSlabs: form.marriedTaxSlabs || [],
        gratuityEnabled: form.gratuityEnabled !== undefined ? form.gratuityEnabled : true,
        gratuityRate: parseFloat(form.gratuityRate) || 8.33,
      };
      if (editItem) await api.updateTaxConfig(editItem.id, payload);
      else await api.createTaxConfig(payload);
      setShowForm(false); setEditItem(null); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteTax(id) {
    if (!confirm('Delete this tax config?')) return;
    await api.deleteTaxConfig(id);
    loadData();
  }

  async function handleSaveAdvance(e) {
    e.preventDefault();
    try {
      await api.createFestivalAdvance({
        employeeId: form.employeeId,
        amount: parseFloat(form.amount),
        fiscalYear: form.fiscalYear || '',
        festivalName: form.festivalName || 'Dashain',
        deductionMonths: parseInt(form.deductionMonths) || 10,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  const tabs = [
    { id: 'tax', label: 'Tax Configuration', icon: Calculator },
    { id: 'advances', label: 'Festival Advances', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nepal Statutory Compliance</h1>
        <button onClick={() => { setShowForm(true); setEditItem(null); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Add {tab === 'tax' ? 'Tax Config' : 'Festival Advance'}
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'tax' ? (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-4">
            <strong>How it works:</strong> The payroll engine automatically looks up the tax config for the active fiscal year when generating payslips.
            SSF, PF, CIT rates and tax slabs defined here override the fallback defaults in Payroll Configuration.
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fiscal Year</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SSF (Emp/Empr)</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PF (Emp/Empr)</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CIT (Emp/Empr)</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gratuity</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tax Slabs</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {configs.map(c => (
                <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.fiscalYear}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{Number(c.ssfEmployeeRate)}% / {Number(c.ssfEmployerRate)}%</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{Number(c.pfEmployeeRate)}% / {Number(c.pfEmployerRate)}%</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{Number(c.citEmployeeRate)}% / {Number(c.citEmployerRate)}%</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{c.gratuityEnabled ? `${Number(c.gratuityRate)}%` : 'Disabled'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {Array.isArray(c.taxSlabs) && c.taxSlabs.length > 0 ? `${c.taxSlabs.length} slabs` : <span className="text-gray-400">Using defaults</span>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => { setEditItem(c); setForm({ ...c, taxSlabs: c.taxSlabs || [], marriedTaxSlabs: c.marriedTaxSlabs || [] }); setShowForm(true); }} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDeleteTax(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {configs.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-gray-400">No tax configurations yet. Add one for the current fiscal year to enable per-year statutory rates.</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Festival</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Remaining</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Monthly Ded.</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {advances.map(a => (
                <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-900">{a.employee?.name || '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{a.festivalName} {a.fiscalYear && <span className="text-xs text-gray-400">({a.fiscalYear})</span>}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-gray-900">NPR {Number(a.amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-gray-600">NPR {Number(a.remainingAmount || a.amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-gray-600">NPR {Number(a.monthlyDeduction || 0).toLocaleString()}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${a.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : a.status === 'DISBURSED' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' : a.status === 'APPROVED' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'}`}>{a.status}</span></td>
                </tr>
              ))}
              {advances.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">No festival advances. Festival advances are auto-deducted from payslips each month.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowForm(false); setEditItem(null); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{tab === 'tax' ? (editItem ? 'Edit Tax Config' : 'Add Tax Config') : 'Add Festival Advance'}</h2>
            <form onSubmit={tab === 'tax' ? handleSaveTax : handleSaveAdvance} className="space-y-4">
              {tab === 'tax' ? <>
                <input placeholder="Fiscal Year (e.g. 2082/83)" value={form.fiscalYear || ''} onChange={e => setForm({ ...form, fiscalYear: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" required disabled={!!editItem} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">SSF Employee %</label>
                    <input type="number" step="0.01" value={form.ssfEmployeeRate ?? 11} onChange={e => setForm({ ...form, ssfEmployeeRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">SSF Employer %</label>
                    <input type="number" step="0.01" value={form.ssfEmployerRate ?? 20} onChange={e => setForm({ ...form, ssfEmployerRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">PF Employee %</label>
                    <input type="number" step="0.01" value={form.pfEmployeeRate ?? 10} onChange={e => setForm({ ...form, pfEmployeeRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">PF Employer %</label>
                    <input type="number" step="0.01" value={form.pfEmployerRate ?? 10} onChange={e => setForm({ ...form, pfEmployerRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">CIT Employee %</label>
                    <input type="number" step="0.01" value={form.citEmployeeRate ?? 0} onChange={e => setForm({ ...form, citEmployeeRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">CIT Employer %</label>
                    <input type="number" step="0.01" value={form.citEmployerRate ?? 0} onChange={e => setForm({ ...form, citEmployerRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.gratuityEnabled !== false} onChange={e => setForm({ ...form, gratuityEnabled: e.target.checked })} className="rounded" />
                      <span className="text-sm text-gray-700">Gratuity Enabled</span>
                    </label>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-500">Gratuity Rate %</label>
                    <input type="number" step="0.01" value={form.gratuityRate ?? 8.33} onChange={e => setForm({ ...form, gratuityRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <TaxSlabEditor label="Tax Slabs (Single)" value={form.taxSlabs || []} onChange={val => setForm({ ...form, taxSlabs: val })} />
                </div>
                <div className="border-t pt-4">
                  <TaxSlabEditor label="Tax Slabs (Married)" value={form.marriedTaxSlabs || []} onChange={val => setForm({ ...form, marriedTaxSlabs: val })} />
                </div>
              </> : <>
                <input placeholder="Employee ID" value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
                <input placeholder="Amount" type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
                <input placeholder="Festival Name" value={form.festivalName || ''} onChange={e => setForm({ ...form, festivalName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <input placeholder="Fiscal Year" value={form.fiscalYear || ''} onChange={e => setForm({ ...form, fiscalYear: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <input placeholder="Deduction Months" type="number" value={form.deductionMonths || ''} onChange={e => setForm({ ...form, deductionMonths: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
