import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Plus, FileText, Receipt, Package } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  APPROVED: 'bg-green-100 text-green-800',
  PAID: 'bg-green-100 text-green-800',
  AVAILABLE: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  UNDER_REPAIR: 'bg-yellow-100 text-yellow-800',
  DISPOSED: 'bg-gray-100 text-gray-800',
};

export default function SelfService() {
  const { dateFormat } = useSettings();
  const [tab, setTab] = useState('documents');
  const [documents, setDocuments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'documents') { const d = await api.getDocumentRequests({}); setDocuments(d.requests || []); }
      else if (tab === 'expenses') { const d = await api.getExpenseClaims({}); setExpenses(d.claims || []); }
      else { const d = await api.getAssets({}); setAssets(d.assets || []); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleCreateDoc(e) {
    e.preventDefault();
    try {
      await api.createDocumentRequest({ type: form.type, purpose: form.purpose });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleCreateExpense(e) {
    e.preventDefault();
    try {
      await api.createExpenseClaim({
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        expenseDate: form.expenseDate || null,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleCreateAsset(e) {
    e.preventDefault();
    try {
      await api.createAsset({
        name: form.name,
        category: form.category,
        assetTag: form.assetTag,
        serialNumber: form.serialNumber,
        purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : null,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleUpdateDoc(id, status) {
    try { await api.updateDocumentRequest(id, { status }); loadData(); }
    catch (err) { alert(err.message); }
  }

  async function handleUpdateExpense(id, status) {
    try { await api.updateExpenseClaim(id, { status }); loadData(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Employee Self-Service</h1>
        <button onClick={() => { setShowForm(true); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> {tab === 'documents' ? 'Request Document' : tab === 'expenses' ? 'Submit Expense' : 'Add Asset'}
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: 'documents', label: 'Documents', icon: FileText }, { id: 'expenses', label: 'Expenses', icon: Receipt }, { id: 'assets', label: 'Assets', icon: Package }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'documents' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map(d => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{d.type}</td>
                  <td className="px-4 py-3 text-sm">{d.employee?.name}</td>
                  <td className="px-4 py-3 text-sm">{d.purpose || '—'}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(d.createdAt, dateFormat)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[d.status] || 'bg-gray-100'}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {d.status === 'PENDING' && (
                      <select onChange={e => handleUpdateDoc(d.id, e.target.value)} defaultValue="" className="text-xs border rounded px-2 py-1">
                        <option value="" disabled>Action</option>
                        <option value="PROCESSING">Process</option>
                        <option value="COMPLETED">Complete</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {documents.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No document requests</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab === 'expenses' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map(ex => (
                <tr key={ex.id}>
                  <td className="px-4 py-3 font-medium">{ex.category}</td>
                  <td className="px-4 py-3 text-sm">{ex.description}</td>
                  <td className="px-4 py-3 text-sm">{ex.employee?.name}</td>
                  <td className="px-4 py-3 text-sm">NPR {Number(ex.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(ex.expenseDate, dateFormat)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[ex.status] || 'bg-gray-100'}`}>{ex.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {ex.status === 'PENDING' && (
                      <select onChange={e => handleUpdateExpense(ex.id, e.target.value)} defaultValue="" className="text-xs border rounded px-2 py-1">
                        <option value="" disabled>Action</option>
                        <option value="APPROVED">Approve</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">No expense claims</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag/Serial</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-sm">{a.category}</td>
                  <td className="px-4 py-3 text-sm">{a.assetTag || a.serialNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">{a.assignments?.[0]?.employee?.name || '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status}</span></td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No assets</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{tab === 'documents' ? 'Request Document' : tab === 'expenses' ? 'Submit Expense' : 'Add Asset'}</h2>
            <form onSubmit={tab === 'documents' ? handleCreateDoc : tab === 'expenses' ? handleCreateExpense : handleCreateAsset} className="space-y-3">
              {tab === 'documents' ? <>
                <select value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2" required>
                  <option value="">Select Document Type</option>
                  <option value="Experience Letter">Experience Letter</option>
                  <option value="Salary Certificate">Salary Certificate</option>
                  <option value="Employment Verification">Employment Verification</option>
                  <option value="Recommendation Letter">Recommendation Letter</option>
                  <option value="Tax Certificate">Tax Certificate</option>
                  <option value="Other">Other</option>
                </select>
                <textarea placeholder="Purpose" value={form.purpose || ''} onChange={e => setForm({ ...form, purpose: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
              </> : tab === 'expenses' ? <>
                <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2" required>
                  <option value="">Select Category</option>
                  <option value="Travel">Travel</option>
                  <option value="Food">Food</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Communication">Communication</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
                <textarea placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" required />
                <input placeholder="Amount (NPR)" type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <DatePicker value={form.expenseDate || ''} onChange={v => setForm({ ...form, expenseDate: v })} placeholder="Expense Date" />
              </> : <>
                <input placeholder="Asset Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2" required>
                  <option value="">Select Category</option>
                  <option value="Laptop">Laptop</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Phone">Phone</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Other">Other</option>
                </select>
                <input placeholder="Asset Tag" value={form.assetTag || ''} onChange={e => setForm({ ...form, assetTag: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Serial Number" value={form.serialNumber || ''} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Purchase Cost (NPR)" type="number" value={form.purchaseCost || ''} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} className="w-full border rounded px-3 py-2" />
              </>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
