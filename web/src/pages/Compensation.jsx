import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Plus, DollarSign, TrendingUp, Gift } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function Compensation() {
  const { dateFormat } = useSettings();
  const [tab, setTab] = useState('grades');
  const [payGrades, setPayGrades] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'grades') { const d = await api.getPayGrades(); setPayGrades(d.payGrades || []); }
      else if (tab === 'revisions') { const d = await api.getSalaryRevisions({}); setRevisions(d.revisions || []); }
      else { const d = await api.getBenefits(); setBenefits(d.benefits || []); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleSaveGrade(e) {
    e.preventDefault();
    try {
      await api.createPayGrade({ name: form.name, level: parseInt(form.level) || 0, minSalary: parseFloat(form.minSalary) || 0, maxSalary: parseFloat(form.maxSalary) || 0 });
      setShowForm(false); setForm({}); loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveRevision(e) {
    e.preventDefault();
    try {
      await api.createSalaryRevision({ employeeId: form.employeeId, previousGross: parseFloat(form.previousSalary) || 0, newGross: parseFloat(form.newSalary), effectiveFrom: form.effectiveDate, reason: form.reason, revisionType: form.revisionType || 'annual' });
      setShowForm(false); setForm({}); loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveBenefit(e) {
    e.preventDefault();
    try {
      await api.createBenefit({ name: form.name, type: form.type, description: form.description, employerContribution: parseFloat(form.employerContribution) || 0, employeeContribution: parseFloat(form.employeeContribution) || 0 });
      setShowForm(false); setForm({}); loadData();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Compensation & Benefits</h1>
        <button onClick={() => { setShowForm(true); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Add {tab === 'grades' ? 'Pay Grade' : tab === 'revisions' ? 'Revision' : 'Benefit'}
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: 'grades', label: 'Pay Grades', icon: DollarSign }, { id: 'revisions', label: 'Salary Revisions', icon: TrendingUp }, { id: 'benefits', label: 'Benefits', icon: Gift }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'grades' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Salary</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payGrades.map(g => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3">{g.level}</td>
                  <td className="px-4 py-3">NPR {Number(g.minSalary).toLocaleString()}</td>
                  <td className="px-4 py-3">NPR {Number(g.maxSalary).toLocaleString()}</td>
                </tr>
              ))}
              {payGrades.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No pay grades configured</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab === 'revisions' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Increment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {revisions.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.employee?.name}</td>
                  <td className="px-4 py-3">NPR {Number(r.previousSalary).toLocaleString()}</td>
                  <td className="px-4 py-3">NPR {Number(r.newSalary).toLocaleString()}</td>
                  <td className="px-4 py-3">{r.incrementPercentage ? `${r.incrementPercentage}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(r.effectiveDate, dateFormat)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>{r.status}</span></td>
                </tr>
              ))}
              {revisions.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No salary revisions</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map(b => (
            <div key={b.id} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900">{b.name}</h3>
              <p className="text-sm text-gray-500">{b.type}</p>
              <p className="text-xs text-gray-400 mt-1">{b.description || ''}</p>
              <div className="mt-2 text-sm">
                <span className="text-gray-600">Employer: NPR {Number(b.employerContribution).toLocaleString()}</span>
                <span className="mx-2">·</span>
                <span className="text-gray-600">Employee: NPR {Number(b.employeeContribution).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {benefits.length === 0 && <div className="col-span-full text-center py-8 text-gray-500 bg-white rounded-lg shadow">No benefit plans</div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add {tab === 'grades' ? 'Pay Grade' : tab === 'revisions' ? 'Salary Revision' : 'Benefit Plan'}</h2>
            <form onSubmit={tab === 'grades' ? handleSaveGrade : tab === 'revisions' ? handleSaveRevision : handleSaveBenefit} className="space-y-3">
              {tab === 'grades' ? <>
                <input placeholder="Grade Name (e.g. Grade A)" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Level" type="number" value={form.level || ''} onChange={e => setForm({ ...form, level: e.target.value })} className="w-full border rounded px-3 py-2" />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Min Salary" type="number" value={form.minSalary || ''} onChange={e => setForm({ ...form, minSalary: e.target.value })} className="border rounded px-3 py-2" />
                  <input placeholder="Max Salary" type="number" value={form.maxSalary || ''} onChange={e => setForm({ ...form, maxSalary: e.target.value })} className="border rounded px-3 py-2" />
                </div>
              </> : tab === 'revisions' ? <>
                <input placeholder="Employee ID" value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Previous Salary" type="number" value={form.previousSalary || ''} onChange={e => setForm({ ...form, previousSalary: e.target.value })} className="border rounded px-3 py-2" />
                  <input placeholder="New Salary" type="number" value={form.newSalary || ''} onChange={e => setForm({ ...form, newSalary: e.target.value })} className="border rounded px-3 py-2" required />
                </div>
                <DatePicker value={form.effectiveDate || ''} onChange={v => setForm({ ...form, effectiveDate: v })} placeholder="Effective Date" required />
                <input placeholder="Increment %" type="number" step="0.1" value={form.incrementPercentage || ''} onChange={e => setForm({ ...form, incrementPercentage: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Reason" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full border rounded px-3 py-2" />
              </> : <>
                <input placeholder="Plan Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <select value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2" required>
                  <option value="">Select Type</option>
                  <option value="Health Insurance">Health Insurance</option>
                  <option value="Life Insurance">Life Insurance</option>
                  <option value="Provident Fund">Provident Fund</option>
                  <option value="Gratuity">Gratuity</option>
                  <option value="Housing Allowance">Housing Allowance</option>
                  <option value="Transport Allowance">Transport Allowance</option>
                  <option value="Other">Other</option>
                </select>
                <textarea placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Employer Contribution" type="number" value={form.employerContribution || ''} onChange={e => setForm({ ...form, employerContribution: e.target.value })} className="border rounded px-3 py-2" />
                  <input placeholder="Employee Contribution" type="number" value={form.employeeContribution || ''} onChange={e => setForm({ ...form, employeeContribution: e.target.value })} className="border rounded px-3 py-2" />
                </div>
              </>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
