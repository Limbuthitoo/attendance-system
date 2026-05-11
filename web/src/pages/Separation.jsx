import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Plus, UserMinus, CheckCircle2, AlertCircle } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const STATUS_COLORS = {
  INITIATED: 'bg-blue-100 text-blue-800',
  NOTICE_PERIOD: 'bg-yellow-100 text-yellow-800',
  CLEARANCE: 'bg-orange-100 text-orange-800',
  SETTLED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

export default function Separation() {
  const { dateFormat } = useSettings();
  const [separations, setSeparations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [selectedSep, setSelectedSep] = useState(null);
  const [clearanceItems, setClearanceItems] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const d = await api.getSeparations({});
      setSeparations(d.separations || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createSeparation({
        employeeId: form.employeeId,
        type: form.type || 'RESIGNATION',
        reason: form.reason,
        lastWorkingDate: form.lastWorkingDate || null,
        noticePeriodDays: parseInt(form.noticePeriodDays) || 30,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleViewClearance(sep) {
    setSelectedSep(sep);
    try {
      const d = await api.getClearanceItems(sep.id);
      setClearanceItems(d.items || []);
    } catch (err) { console.error(err); }
  }

  async function handleClearItem(itemId) {
    try {
      await api.updateClearanceItem(itemId, { status: 'CLEARED' });
      handleViewClearance(selectedSep);
    } catch (err) { alert(err.message); }
  }

  async function handleUpdateStatus(id, status) {
    try {
      await api.updateSeparation(id, { status });
      loadData();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Separation & Offboarding</h1>
        <button onClick={() => { setShowForm(true); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Initiate Separation
        </button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Working Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {separations.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3"><div className="font-medium">{s.employee?.name}</div><div className="text-xs text-gray-500">{s.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-sm">{s.type}</td>
                  <td className="px-4 py-3 text-sm">{s.lastWorkingDate ? formatDate(s.lastWorkingDate, dateFormat) : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => handleViewClearance(s)} className="text-xs text-blue-600 hover:underline">Clearance</button>
                    {s.status !== 'COMPLETED' && (
                      <select onChange={e => handleUpdateStatus(s.id, e.target.value)} value={s.status} className="text-xs border rounded px-1 py-0.5">
                        {['INITIATED','NOTICE_PERIOD','CLEARANCE','SETTLED','COMPLETED'].map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {separations.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No separation records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedSep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Clearance - {selectedSep.employee?.name}</h2>
              <button onClick={() => setSelectedSep(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clearanceItems.map(item => (
                <div key={item.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <p className="font-medium text-sm">{item.department}</p>
                    <p className="text-xs text-gray-500">{item.description || ''}</p>
                  </div>
                  {item.status === 'CLEARED' ? (
                    <CheckCircle2 className="text-green-500" size={20} />
                  ) : (
                    <button onClick={() => handleClearItem(item.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Clear</button>
                  )}
                </div>
              ))}
              {clearanceItems.length === 0 && <p className="text-center text-gray-500 py-4">No clearance items</p>}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Initiate Separation</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Employee ID" value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <select value={form.type || 'RESIGNATION'} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2">
                <option value="RESIGNATION">Resignation</option>
                <option value="TERMINATION">Termination</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="CONTRACT_END">Contract End</option>
              </select>
              <textarea placeholder="Reason" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
              <DatePicker value={form.lastWorkingDate || ''} onChange={v => setForm({ ...form, lastWorkingDate: v })} placeholder="Last Working Date" />
              <input type="number" placeholder="Notice Period (days)" value={form.noticePeriodDays || ''} onChange={e => setForm({ ...form, noticePeriodDays: e.target.value })} className="w-full border rounded px-3 py-2" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Initiate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
