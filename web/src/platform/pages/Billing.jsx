import { useState, useEffect } from 'react';
import {
  getInvoices, getBillingStats, createInvoice, markInvoicePaid,
  deleteInvoice, getOrganizations, getPlans,
} from '../api';
import { Receipt, Plus, CheckCircle, Trash2, X, DollarSign, AlertTriangle, Clock } from 'lucide-react';

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [showPayModal, setShowPayModal] = useState(null);
  const [form, setForm] = useState({
    orgId: '', planId: '', amount: '', billingPeriodStart: '', billingPeriodEnd: '', dueDate: '', notes: '',
  });
  const [payForm, setPayForm] = useState({ paymentMethod: '', paymentRef: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getOrganizations({ limit: 200 }),
      getPlans(),
    ]).then(([orgData, planData]) => {
      setOrgs(orgData.organizations || []);
      setPlans(planData.plans || planData);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const [invData, statsData] = await Promise.all([
        getInvoices({ status: statusFilter, page, limit: 15 }),
        getBillingStats(),
      ]);
      setInvoices(invData.invoices || []);
      setTotalPages(invData.totalPages || 1);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ orgId: '', planId: '', amount: '', billingPeriodStart: '', billingPeriodEnd: '', dueDate: '', notes: '' });
    setError('');
    setShowCreate(true);
  }

  // Auto-fill amount when org+plan selected
  function handleOrgChange(orgId) {
    const org = orgs.find((o) => o.id === orgId);
    const planId = org?.planId || '';
    const plan = plans.find((p) => p.id === planId);
    setForm((f) => ({
      ...f,
      orgId,
      planId,
      amount: plan ? String(plan.price) : f.amount,
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createInvoice({
        ...form,
        amount: Number(form.amount),
      });
      setShowCreate(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await markInvoicePaid(showPayModal.id, payForm);
      setShowPayModal(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(inv) {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    try {
      await deleteInvoice(inv.id);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  }

  function fmt(amount) {
    return `NPR ${(amount / 100).toLocaleString()}`;
  }

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Track payments and generate invoices</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={DollarSign} label="Total Revenue" value={fmt(stats.totalRevenue)} color="text-green-600" bg="bg-green-50" />
          <StatCard icon={Clock} label="Pending Amount" value={fmt(stats.pendingAmount)} color="text-yellow-600" bg="bg-yellow-50" />
          <StatCard icon={AlertTriangle} label="Overdue Invoices" value={stats.overdueCount} color="text-red-600" bg="bg-red-50" />
          <StatCard icon={Receipt} label="Total Invoices" value={invoices.length > 0 ? `Page ${page}/${totalPages}` : '0'} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Invoice table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No invoices found
              </td></tr>
            )}
            {!loading && invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono font-medium">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-sm">{inv.organization?.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{inv.plan?.name || '—'}</td>
                <td className="px-4 py-3 text-sm font-medium">{fmt(inv.amount)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(inv.billingPeriodStart).toLocaleDateString()} — {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {inv.status !== 'PAID' && (
                      <button
                        onClick={() => { setShowPayModal(inv); setPayForm({ paymentMethod: '', paymentRef: '' }); setError(''); }}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                        title="Mark Paid"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {inv.status !== 'PAID' && (
                      <button
                        onClick={() => handleDelete(inv)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {inv.status === 'PAID' && inv.paidAt && (
                      <span className="text-xs text-gray-400">
                        Paid {new Date(inv.paidAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreate && (
        <Modal title="Create Invoice" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
              <select required value={form.orgId} onChange={(e) => handleOrgChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select organization</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select value={form.planId} onChange={(e) => {
                  const plan = plans.find((p) => p.id === e.target.value);
                  setForm({ ...form, planId: e.target.value, amount: plan ? String(plan.price) : form.amount });
                }} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">—</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (paisa) *</label>
                <input required type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                {form.amount && <p className="text-xs text-gray-400 mt-0.5">= NPR {(Number(form.amount) / 100).toLocaleString()}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Start *</label>
                <input required type="date" value={form.billingPeriodStart} onChange={(e) => setForm({ ...form, billingPeriodStart: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing End *</label>
                <input required type="date" value={form.billingPeriodEnd} onChange={(e) => setForm({ ...form, billingPeriodEnd: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <Modal title={`Mark ${showPayModal.invoiceNumber} as Paid`} onClose={() => setShowPayModal(null)}>
          <form onSubmit={handleMarkPaid} className="space-y-4">
            <p className="text-sm text-gray-500">
              Amount: <strong>{fmt(showPayModal.amount)}</strong> — {showPayModal.organization?.name}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select method</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
                <option value="fonepay">FonePay</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
              <input value={payForm.paymentRef} onChange={(e) => setPayForm({ ...payForm, paymentRef: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Transaction ID or ref number" />
            </div>
            {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowPayModal(null)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-lg font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
