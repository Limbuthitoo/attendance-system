import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';

const PARTY_TYPES = ['CUSTOMER', 'VENDOR', 'BOTH'];
const INVOICE_TYPES = ['SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN'];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_WALLET', 'CREDIT_CARD', 'OTHER'];

// Shared billing settings context
function useBillingSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    (async () => {
      try { const s = await api.getSettings(); setSettings(s); } catch { /* use defaults */ }
    })();
  }, []);
  return settings || { defaultVatRate: 13, currency: 'NPR', salesPrefix: 'INV', purchasePrefix: 'PUR', creditNotePrefix: 'CN', debitNotePrefix: 'DN', receiptPrefix: 'RCV', paymentVoucherPrefix: 'PAY', invoiceSeqPadding: 4, receiptSeqPadding: 5, cashAccountCode: '1101', bankAccountCode: '1102', receivableAccountCode: '1201', payableAccountCode: '2101', salesRevenueCode: '4100', purchaseExpenseCode: '5700', vatPayableCode: '2201', vatReceivableCode: '1500', tdsReceivableCode: '1500', tdsPayableCode: '2202' };
}

export default function Billing() {
  const { dateFormat } = useSettings();
  const [tab, setTab] = useState('invoices');
  const settings = useBillingSettings();
  const tabs = [
    { id: 'invoices', label: 'Invoices' },
    { id: 'parties', label: 'Parties' },
    { id: 'payments', label: 'Payments' },
    { id: 'reports', label: 'Reports' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
      </div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`pb-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      {tab === 'invoices' && <InvoicesTab settings={settings} />}
      {tab === 'parties' && <PartiesTab settings={settings} />}
      {tab === 'payments' && <PaymentsTab settings={settings} />}
      {tab === 'reports' && <BillingReportsTab settings={settings} />}
      {tab === 'settings' && <BillingSettingsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PartiesTab({ settings }) {
  const { dateFormat } = useSettings();
  const cur = settings.currency || 'NPR';
  const [parties, setParties] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', nameNp: '', type: 'CUSTOMER', panNumber: '', vatNumber: '', address: '', city: '', phone: '', email: '', bankName: '', bankAccount: '', creditLimit: '', creditDays: 0, openingBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState(null);

  const load = useCallback(async () => {
    try { const data = await api.getParties({ type: filterType || undefined, search: search || undefined }); setParties(data); } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType, search]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.updateParty(editId, form);
      else await api.createParty(form);
      setShowForm(false); setEditId(null); setForm({ name: '', nameNp: '', type: 'CUSTOMER', panNumber: '', vatNumber: '', address: '', city: '', phone: '', email: '', bankName: '', bankAccount: '', creditLimit: '', creditDays: 0, openingBalance: 0 }); load();
    } catch (e) { alert(e.message); }
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, nameNp: p.nameNp || '', type: p.type, panNumber: p.panNumber || '', vatNumber: p.vatNumber || '', address: p.address || '', city: p.city || '', phone: p.phone || '', email: p.email || '', bankName: p.bankName || '', bankAccount: p.bankAccount || '', creditLimit: p.creditLimit || '', creditDays: p.creditDays || 0, openingBalance: Number(p.openingBalance) || 0 });
    setEditId(p.id); setShowForm(true);
  };

  const handleStatement = async (p) => {
    try { const data = await api.getPartyStatement(p.id); setStatement(data); } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, PAN, phone..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{showForm ? 'Cancel' : '+ New Party'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name (Nepali)</label><input value={form.nameNp} onChange={e => setForm({ ...form, nameNp: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label><input value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value })} maxLength={9} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="9-digit PAN" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label><input value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit ({cur})</label><input type="number" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Days</label><input type="number" value={form.creditDays} onChange={e => setForm({ ...form, creditDays: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label><input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label><input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Bank Account #</label><input value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex justify-end"><button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">{editId ? 'Update' : 'Create'}</button></div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PAN</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">City</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoices</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {parties.map(p => (
              <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-5 py-3 text-sm text-gray-900 font-medium">{p.name}{p.nameNp && <span className="text-gray-400 text-xs ml-2">{p.nameNp}</span>}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 font-medium rounded-full ${p.type === 'CUSTOMER' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : p.type === 'VENDOR' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' : 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20'}`}>{p.type}</span></td>
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{p.panNumber || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{p.phone || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{p.city || '—'}</td>
                <td className="px-5 py-3 text-sm text-right text-gray-600">{p._count?.invoices || 0}</td>
                <td className="px-5 py-3 space-x-3">
                  <button onClick={() => handleEdit(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  <button onClick={() => handleStatement(p)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Statement</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {parties.length === 0 && <p className="text-center py-8 text-gray-400">No parties found. Add customers and vendors to get started.</p>}
      </div>

      {/* Party Statement Modal */}
      {statement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setStatement(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Party Statement — {statement.party.name}</h3>
                <p className="text-sm text-gray-500">{statement.party.type} {statement.party.panNumber ? `| PAN: ${statement.party.panNumber}` : ''}</p>
              </div>
              <button onClick={() => setStatement(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Total Invoiced</p>
                <p className="text-lg font-bold font-mono">{cur} {statement.totalInvoiced.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="text-lg font-bold font-mono text-emerald-600">{cur} {statement.totalPaid.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-lg font-bold font-mono text-red-600">{cur} {statement.totalOutstanding.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead><tr>
                <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Date</th>
                <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Ref</th>
                <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Type</th>
                <th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Debit</th>
                <th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Credit</th>
                <th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Balance</th>
              </tr></thead>
              <tbody>
                {statement.openingBalance !== 0 && <tr className="bg-amber-50/50"><td colSpan="5" className="py-2 text-sm italic text-gray-500">Opening Balance</td><td className="py-2 text-right font-mono font-bold">{statement.openingBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td></tr>}
                {statement.ledger.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                    <td className="py-2 text-gray-600">{formatDate(e.date, dateFormat)}</td>
                    <td className="py-2 font-mono text-blue-600">{e.ref}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded ${e.type === 'invoice' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>{e.type === 'invoice' ? e.subType : e.subType}</span></td>
                    <td className="py-2 text-right font-mono">{e.debit > 0 ? e.debit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td>
                    <td className="py-2 text-right font-mono">{e.credit > 0 ? e.credit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td>
                    <td className="py-2 text-right font-mono font-bold">{e.balance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold"><td colSpan="5" className="py-2 text-right text-sm">Closing Balance</td><td className="py-2 text-right font-mono">{statement.closingBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table>
            {statement.ledger.length === 0 && <p className="text-center py-4 text-gray-500">No transactions found for this party.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function InvoicesTab({ settings }) {
  const { dateFormat } = useSettings();
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const cur = settings.currency || 'NPR';
  const defVat = Number(settings.defaultVatRate) || 13;
  const [form, setForm] = useState({
    type: 'SALES', partyId: '', date: new Date().toISOString().split('T')[0], dueDate: '',
    isVatBill: true, vatRate: defVat, tdsRate: 0, discountAmount: 0, panOfBuyer: '', notes: '',
    items: [{ description: '', quantity: 1, unit: 'pcs', rate: 0, discount: 0, taxRate: defVat }],
  });

  const load = useCallback(async () => {
    try {
      const [data, pts] = await Promise.all([api.getInvoices({ type: filterType || undefined, status: filterStatus || undefined }), api.getParties()]);
      setInvoices(data); setParties(pts);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType, filterStatus]);
  useEffect(() => { load(); }, [load]);

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit: 'pcs', rate: 0, discount: 0, taxRate: 13 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });
  const updateItem = (i, field, val) => { const items = [...form.items]; items[i] = { ...items[i], [field]: val }; setForm({ ...form, items }); };

  const calcItem = (item) => {
    const amount = (Number(item.quantity) * Number(item.rate)) - Number(item.discount);
    const taxAmount = form.isVatBill ? (amount * Number(item.taxRate || 13)) / 100 : 0;
    return { amount, taxAmount, total: amount + taxAmount };
  };

  const subtotal = form.items.reduce((s, i) => s + calcItem(i).amount, 0);
  const taxableAmount = subtotal - Number(form.discountAmount);
  const vatAmount = form.isVatBill ? (taxableAmount * Number(form.vatRate)) / 100 : 0;
  const tdsAmount = (taxableAmount * Number(form.tdsRate)) / 100;
  const totalAmount = taxableAmount + vatAmount - tdsAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createInvoice(form);
      setShowForm(false); setForm({ type: 'SALES', partyId: '', date: new Date().toISOString().split('T')[0], dueDate: '', isVatBill: true, vatRate: defVat, tdsRate: 0, discountAmount: 0, panOfBuyer: '', notes: '', items: [{ description: '', quantity: 1, unit: 'pcs', rate: 0, discount: 0, taxRate: defVat }] }); load();
    } catch (e) { alert(e.message); }
  };

  const handleIssue = async (id) => { try { await api.issueInvoice(id); load(); } catch (e) { alert(e.message); } };
  const handleCancel = async (id) => { if (confirm('Cancel this invoice?')) { try { await api.cancelInvoice(id); load(); } catch (e) { alert(e.message); } } };

  const viewInvoice = async (id) => {
    try { const inv = await api.getInvoice(id); setSelectedInvoice(inv); } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option><option value="ISSUED">Issued</option><option value="PARTIALLY_PAID">Partially Paid</option><option value="PAID">Paid</option><option value="OVERDUE">Overdue</option><option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{showForm ? 'Cancel' : '+ New Invoice'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{INVOICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Party *</label><select value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Select Party</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type}){p.panNumber ? ` — PAN: ${p.panNumber}` : ''}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><DatePicker value={form.date} onChange={v => setForm({ ...form, date: v })} placeholder="Date" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label><DatePicker value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} placeholder="Due Date" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isVatBill} onChange={e => setForm({ ...form, isVatBill: e.target.checked })} className="rounded" /><span className="text-gray-700">VAT Bill ({defVat}%)</span></label>
            <div className="flex items-center gap-2"><span className="text-gray-600">TDS %:</span><input type="number" step="0.5" min="0" max="100" value={form.tdsRate} onChange={e => setForm({ ...form, tdsRate: parseFloat(e.target.value) || 0 })} className="w-20 border rounded px-2 py-1 text-sm" /></div>
            <div className="flex items-center gap-2"><span className="text-gray-600">Buyer PAN:</span><input value={form.panOfBuyer} onChange={e => setForm({ ...form, panOfBuyer: e.target.value })} maxLength={9} className="w-32 border rounded px-2 py-1 text-sm" /></div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-medium text-gray-700">Line Items</h3><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button></div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr>
                  <th className="text-left text-xs text-gray-500 pb-1">Description</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-20">Qty</th>
                  <th className="text-left text-xs text-gray-500 pb-1 w-20">Unit</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-28">Rate ({cur})</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-24">Discount</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-24">Amount</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-20">Tax %</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-24">Tax Amt</th>
                  <th className="text-right text-xs text-gray-500 pb-1 w-28">Total</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody>
                  {form.items.map((item, i) => {
                    const calc = calcItem(item);
                    return (
                      <tr key={i}>
                        <td className="pr-2 py-1"><input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} required className="w-full border rounded px-2 py-1.5" placeholder="Item description" /></td>
                        <td className="pr-2 py-1"><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="w-full border rounded px-2 py-1.5 text-right" /></td>
                        <td className="pr-2 py-1"><input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="w-full border rounded px-2 py-1.5" /></td>
                        <td className="pr-2 py-1"><input type="number" step="0.01" min="0" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} className="w-full border rounded px-2 py-1.5 text-right" /></td>
                        <td className="pr-2 py-1"><input type="number" step="0.01" min="0" value={item.discount} onChange={e => updateItem(i, 'discount', e.target.value)} className="w-full border rounded px-2 py-1.5 text-right" /></td>
                        <td className="pr-2 py-1 text-right font-mono">{calc.amount.toFixed(2)}</td>
                        <td className="pr-2 py-1"><input type="number" step="0.5" min="0" value={item.taxRate} onChange={e => updateItem(i, 'taxRate', e.target.value)} className="w-full border rounded px-2 py-1.5 text-right" /></td>
                        <td className="pr-2 py-1 text-right font-mono">{calc.taxAmount.toFixed(2)}</td>
                        <td className="pr-2 py-1 text-right font-mono font-bold">{calc.total.toFixed(2)}</td>
                        <td className="py-1">{form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-500 text-xs">✕</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-mono">{cur} {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600">Discount:</span><div className="flex items-center gap-1"><span className="text-gray-400">{cur}</span><input type="number" step="0.01" min="0" value={form.discountAmount} onChange={e => setForm({ ...form, discountAmount: parseFloat(e.target.value) || 0 })} className="w-24 border rounded px-2 py-1 text-right text-sm" /></div></div>
              <div className="flex justify-between"><span className="text-gray-600">Taxable Amount:</span><span className="font-mono">{cur} {taxableAmount.toFixed(2)}</span></div>
              {form.isVatBill && <div className="flex justify-between"><span className="text-gray-600">VAT ({form.vatRate}%):</span><span className="font-mono">{cur} {vatAmount.toFixed(2)}</span></div>}
              {form.tdsRate > 0 && <div className="flex justify-between"><span className="text-gray-600">TDS ({form.tdsRate}%):</span><span className="font-mono text-red-600">-{cur} {tdsAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span className="font-mono">{cur} {totalAmount.toFixed(2)}</span></div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="flex-1 mr-4 border rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">Create Invoice</button>
          </div>
        </form>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-sm text-gray-500">{selectedInvoice.type} | {selectedInvoice.party?.name} | {formatDate(selectedInvoice.date, dateFormat)}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <table className="min-w-full text-sm mb-4">
              <thead><tr className="border-b"><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Rate</th><th className="text-right py-2">Amount</th><th className="text-right py-2">Tax</th><th className="text-right py-2">Total</th></tr></thead>
              <tbody>{selectedInvoice.items?.map(item => (<tr key={item.id} className="border-b"><td className="py-2">{item.description}</td><td className="py-2 text-right">{Number(item.quantity)} {item.unit}</td><td className="py-2 text-right font-mono">{Number(item.rate).toFixed(2)}</td><td className="py-2 text-right font-mono">{Number(item.amount).toFixed(2)}</td><td className="py-2 text-right font-mono">{Number(item.taxAmount).toFixed(2)}</td><td className="py-2 text-right font-mono font-bold">{Number(item.totalAmount).toFixed(2)}</td></tr>))}</tbody>
            </table>
            <div className="flex justify-end"><div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal:</span><span className="font-mono">{cur} {Number(selectedInvoice.subtotal).toFixed(2)}</span></div>
              {Number(selectedInvoice.discountAmount) > 0 && <div className="flex justify-between"><span>Discount:</span><span className="font-mono">-{cur} {Number(selectedInvoice.discountAmount).toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>Taxable:</span><span className="font-mono">{cur} {Number(selectedInvoice.taxableAmount).toFixed(2)}</span></div>
              {Number(selectedInvoice.vatAmount) > 0 && <div className="flex justify-between"><span>VAT ({Number(selectedInvoice.vatRate)}%):</span><span className="font-mono">{cur} {Number(selectedInvoice.vatAmount).toFixed(2)}</span></div>}
              {Number(selectedInvoice.tdsAmount) > 0 && <div className="flex justify-between"><span>TDS:</span><span className="font-mono text-red-600">-{cur} {Number(selectedInvoice.tdsAmount).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-1"><span>Total:</span><span className="font-mono">{cur} {Number(selectedInvoice.totalAmount).toFixed(2)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid:</span><span className="font-mono">{cur} {Number(selectedInvoice.paidAmount).toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-red-600"><span>Due:</span><span className="font-mono">{cur} {Number(selectedInvoice.dueAmount).toFixed(2)}</span></div>
            </div></div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Party</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Due</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {invoices.map(inv => (
              <tr key={inv.id} className="cursor-pointer hover:bg-blue-50/40 transition-colors" onClick={() => viewInvoice(inv.id)}>
                <td className="px-5 py-3 text-sm font-mono font-medium text-blue-600">{inv.invoiceNumber}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 font-medium rounded-md ${inv.type === 'SALES' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : inv.type === 'PURCHASE' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'}`}>{inv.type}</span></td>
                <td className="px-5 py-3 text-sm text-gray-900">{inv.party?.name}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{formatDate(inv.date, dateFormat)}</td>
                <td className="px-5 py-3 text-sm text-right font-mono text-gray-900">{Number(inv.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 text-sm text-right font-mono text-red-600">{Number(inv.dueAmount) > 0 ? Number(inv.dueAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 }) : '—'}</td>
                <td className="px-5 py-3"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : inv.status === 'ISSUED' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' : inv.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' : inv.status === 'PARTIALLY_PAID' ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20' : inv.status === 'OVERDUE' ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20' : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'}`}>{inv.status}</span></td>
                <td className="px-5 py-3 space-x-3" onClick={e => e.stopPropagation()}>
                  {inv.status === 'DRAFT' && <button onClick={() => handleIssue(inv.id)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Issue</button>}
                  {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && <button onClick={() => handleCancel(inv.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {invoices.length === 0 && <p className="text-center py-8 text-gray-400">No invoices found.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PaymentsTab({ settings }) {
  const { dateFormat } = useSettings();
  const cur = settings.currency || 'NPR';
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'RECEIVED', partyId: '', invoiceId: '', date: new Date().toISOString().split('T')[0], amount: '', method: 'CASH', bankName: '', chequeNumber: '', referenceId: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const [data, pts, invs] = await Promise.all([api.getPayments({ type: filterType || undefined }), api.getParties(), api.getInvoices({ status: 'ISSUED' })]);
      setPayments(data); setParties(pts);
      setInvoices([...(await api.getInvoices({ status: 'PARTIALLY_PAID' })), ...invs]);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.recordPayment(form);
      setShowForm(false); setForm({ type: 'RECEIVED', partyId: '', invoiceId: '', date: new Date().toISOString().split('T')[0], amount: '', method: 'CASH', bankName: '', chequeNumber: '', referenceId: '', notes: '' }); load();
    } catch (e) { alert(e.message); }
  };

  const handleVoid = async (id) => {
    if (!confirm('Void this payment? This will reverse the invoice amount and void the journal entry.')) return;
    try { await api.voidPayment(id); load(); } catch (e) { alert(e.message); }
  };

  const filteredInvoices = invoices.filter(i => !form.partyId || i.partyId === form.partyId);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="RECEIVED">Received</option>
          <option value="MADE">Made</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{showForm ? 'Cancel' : '+ Record Payment'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="RECEIVED">Received (from customer)</option><option value="MADE">Made (to vendor)</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Party *</label><select value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Select Party</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Against Invoice</label><select value={form.invoiceId} onChange={e => { const inv = invoices.find(i => i.id === e.target.value); setForm({ ...form, invoiceId: e.target.value, amount: inv ? Number(inv.dueAmount) : form.amount }); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">None (Advance)</option>{filteredInvoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} — Due: {cur} {Number(i.dueAmount).toFixed(2)}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><DatePicker value={form.date} onChange={v => setForm({ ...form, date: v })} placeholder="Date" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount ({cur}) *</label><input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Method</label><select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}</select></div>
          </div>
          {(form.method === 'BANK_TRANSFER' || form.method === 'CHEQUE') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label><input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              {form.method === 'CHEQUE' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Cheque #</label><input value={form.chequeNumber} onChange={e => setForm({ ...form, chequeNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reference / UTR</label><input value={form.referenceId} onChange={e => setForm({ ...form, referenceId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
          )}
          {form.method === 'MOBILE_WALLET' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Wallet (eSewa, Khalti, etc.)</label><input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label><input value={form.referenceId} onChange={e => setForm({ ...form, referenceId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="flex-1 mr-4 border rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">Record Payment</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Receipt #</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Party</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Method</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {payments.map(p => (
              <tr key={p.id} className={`hover:bg-blue-50/40 transition-colors ${p.isVoided ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3 text-sm font-mono text-gray-900">{p.receiptNumber}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 font-medium rounded-full ${p.type === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20'}`}>{p.type}</span></td>
                <td className="px-5 py-3 text-sm text-gray-900">{p.party?.name}</td>
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{p.invoice?.invoiceNumber || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{formatDate(p.date, dateFormat)}</td>
                <td className="px-5 py-3 text-sm text-right font-mono font-bold text-gray-900">{cur} {Number(p.amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3"><span className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-md ring-1 ring-gray-200 font-medium">{p.method.replace(/_/g, ' ')}</span></td>
                <td className="px-5 py-3">{p.isVoided ? <span className="text-xs px-2.5 py-1 font-medium rounded-full bg-red-50 text-red-700 ring-1 ring-red-600/20">VOIDED</span> : <span className="text-xs px-2.5 py-1 font-medium rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">ACTIVE</span>}</td>
                <td className="px-5 py-3">{!p.isVoided && <button onClick={() => handleVoid(p.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Void</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {payments.length === 0 && <p className="text-center py-8 text-gray-400">No payments recorded.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB (Aging + VAT Summary)
// ═══════════════════════════════════════════════════════════════════════════════

function BillingReportsTab({ settings }) {
  const { dateFormat } = useSettings();
  const cur = settings.currency || 'NPR';
  const [report, setReport] = useState('aging-receivable');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });

  const loadReport = async () => {
    setLoading(true);
    try {
      if (report === 'aging-receivable') setData({ type: 'aging', ...(await api.getAgingReport({ type: 'receivable' })) });
      else if (report === 'aging-payable') setData({ type: 'aging', ...(await api.getAgingReport({ type: 'payable' })) });
      else if (report === 'vat-summary') setData({ type: 'vat', ...(await api.getVatSummary(dateFilter.startDate ? dateFilter : undefined)) });
      else if (report === 'day-book') setData({ type: 'day-book', ...(await api.getDayBook(dateFilter.startDate ? dateFilter : { date: new Date().toISOString().split('T')[0] })) });
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report</label>
          <select value={report} onChange={e => setReport(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="aging-receivable">Aging — Receivable</option>
            <option value="aging-payable">Aging — Payable</option>
            <option value="vat-summary">VAT Summary (for IRD)</option>
            <option value="day-book">Day Book</option>
          </select>
        </div>
        {(report === 'vat-summary' || report === 'day-book') && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <DatePicker value={dateFilter.startDate} onChange={v => setDateFilter({ ...dateFilter, startDate: v })} placeholder="From" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <DatePicker value={dateFilter.endDate} onChange={v => setDateFilter({ ...dateFilter, endDate: v })} placeholder="To" />
            </div>
          </div>
        )}
        <button onClick={loadReport} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{loading ? 'Loading...' : 'Generate'}</button>
      </div>

      {data?.type === 'aging' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Aging Report</h3>
            <span className="text-lg font-bold text-red-600">Total Outstanding: {cur} {data.totalOutstanding.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[{ key: 'current', label: 'Current', color: 'emerald' }, { key: '1_30', label: '1-30 Days', color: 'amber' }, { key: '31_60', label: '31-60 Days', color: 'orange' }, { key: '61_90', label: '61-90 Days', color: 'red' }, { key: 'over90', label: '90+ Days', color: 'red' }].map(b => (
              <div key={b.key} className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-center">
                <p className="text-xs text-gray-500">{b.label}</p>
                <p className="text-lg font-bold text-gray-900 font-mono">{cur} {(data.totals[b.key] || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-400">{(data.buckets[b.key] || []).length} invoices</p>
              </div>
            ))}
          </div>
          {Object.entries(data.buckets).flatMap(([k, items]) => items).length > 0 && (
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead><tr><th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Invoice</th><th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Party</th><th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Amount Due</th><th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Days Overdue</th></tr></thead>
              <tbody>{Object.entries(data.buckets).flatMap(([, items]) => items).sort((a, b) => b.daysOverdue - a.daysOverdue).map((item, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30"><td className="py-2 font-mono">{item.invoiceNumber}</td><td className="py-2">{item.party}</td><td className="py-2 text-right font-mono">{cur} {item.amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td><td className="py-2 text-right"><span className={`px-2 py-0.5 rounded text-xs font-medium ${item.daysOverdue <= 0 ? 'bg-emerald-50 text-emerald-700' : item.daysOverdue <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{item.daysOverdue} days</span></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {data?.type === 'vat' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">VAT Summary (IRD Report)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-green-700">OUTPUT VAT (Sales)</h4>
              <div className="flex justify-between text-sm"><span>Sales Count:</span><span>{data.sales.count}</span></div>
              <div className="flex justify-between text-sm"><span>Taxable Amount:</span><span className="font-mono">{cur} {data.sales.taxable.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>VAT Collected:</span><span className="font-mono">{cur} {data.sales.vat.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
              {data.salesReturns.count > 0 && <div className="flex justify-between text-sm text-red-600"><span>Less: Sales Returns VAT:</span><span className="font-mono">-{cur} {data.salesReturns.vat.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-blue-700">INPUT VAT (Purchases)</h4>
              <div className="flex justify-between text-sm"><span>Purchase Count:</span><span>{data.purchases.count}</span></div>
              <div className="flex justify-between text-sm"><span>Taxable Amount:</span><span className="font-mono">{cur} {data.purchases.taxable.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>VAT Paid:</span><span className="font-mono">{cur} {data.purchases.vat.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
              {data.purchaseReturns.count > 0 && <div className="flex justify-between text-sm text-red-600"><span>Less: Purchase Returns VAT:</span><span className="font-mono">-{cur} {data.purchaseReturns.vat.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>}
            </div>
          </div>
          <div className={`text-center py-4 border-t text-xl font-bold ${data.netVatPayable >= 0 ? 'text-red-700' : 'text-green-700'}`}>
            Net VAT {data.netVatPayable >= 0 ? 'Payable' : 'Receivable'}: {cur} {Math.abs(data.netVatPayable).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
          </div>
        </div>
      )}

      {data?.type === 'day-book' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Day Book</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Invoices</p>
              <p className="text-lg font-bold">{data.summary.totalInvoices}</p>
              <p className="text-xs font-mono text-gray-600">{cur} {data.summary.totalInvoiceAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Payments</p>
              <p className="text-lg font-bold">{data.summary.totalPayments}</p>
              <p className="text-xs font-mono text-gray-600">{cur} {data.summary.totalPaymentAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Journals</p>
              <p className="text-lg font-bold">{data.summary.totalJournals}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Entries</p>
              <p className="text-lg font-bold">{data.entries.length}</p>
            </div>
          </div>
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead><tr>
              <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Date</th>
              <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Ref</th>
              <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Category</th>
              <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Type</th>
              <th className="text-left py-2.5 text-xs text-gray-500 uppercase font-semibold">Party</th>
              <th className="text-right py-2.5 text-xs text-gray-500 uppercase font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                  <td className="py-2 text-gray-600">{formatDate(e.date, dateFormat)}</td>
                  <td className="py-2 font-mono text-blue-600">{e.ref}</td>
                  <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded font-medium ${e.category === 'invoice' ? 'bg-sky-50 text-sky-700' : e.category === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>{e.category}</span></td>
                  <td className="py-2 text-xs text-gray-600">{e.type}{e.method ? ` (${e.method.replace(/_/g, ' ')})` : ''}</td>
                  <td className="py-2 text-gray-900">{e.party || e.narration || '—'}</td>
                  <td className="py-2 text-right font-mono font-bold">{cur} {e.amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <p className="text-center py-4 text-gray-500">No transactions found for this date.</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BillingSettingsTab() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, accts] = await Promise.all([api.getSettings(), api.getAccounts()]);
        setSettings(s);
        setAccounts(accts.filter(a => !a.isGroup));
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setMsg('Settings saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  if (!settings) return <div className="text-center py-8 text-gray-500">Loading settings...</div>;

  const Field = ({ label, field, type = 'text', hint }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={settings[field] ?? ''} onChange={e => setSettings({ ...settings, [field]: type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  const AccountSelect = ({ label, field, hint }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={settings[field] || ''} onChange={e => setSettings({ ...settings, [field]: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="">Select Account</option>
        {accounts.map(a => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {msg && <div className={`px-4 py-3 rounded-lg text-sm ${msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}

      {/* General */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">General</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Default VAT Rate (%)" field="defaultVatRate" type="number" hint="Applied when no rate is specified on invoice" />
          <Field label="Currency" field="currency" hint="Display currency code (e.g., NPR, INR, USD)" />
        </div>
      </div>

      {/* Invoice Number Format */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Invoice & Receipt Number Format</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Sales Invoice Prefix" field="salesPrefix" hint="e.g., INV" />
          <Field label="Purchase Invoice Prefix" field="purchasePrefix" hint="e.g., PUR" />
          <Field label="Credit Note Prefix" field="creditNotePrefix" hint="e.g., CN" />
          <Field label="Debit Note Prefix" field="debitNotePrefix" hint="e.g., DN" />
          <Field label="Receipt Prefix" field="receiptPrefix" hint="e.g., RCV" />
          <Field label="Payment Voucher Prefix" field="paymentVoucherPrefix" hint="e.g., PAY" />
          <Field label="Invoice Seq. Padding" field="invoiceSeqPadding" type="number" hint="Zero-pad width (4 = 0001)" />
          <Field label="Receipt Seq. Padding" field="receiptSeqPadding" type="number" hint="Zero-pad width (5 = 00001)" />
        </div>
        <p className="text-xs text-gray-400 mt-3">Format preview: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{settings.salesPrefix}-2082/83-{String(1).padStart(settings.invoiceSeqPadding || 4, '0')}</span></p>
      </div>

      {/* Account Mappings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Account Mappings</h3>
        <p className="text-sm text-gray-500 mb-4">These accounts are used for auto-generated journal entries when invoices are issued and payments are recorded.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccountSelect label="Cash Account" field="cashAccountCode" hint="Used for cash payments/receipts" />
          <AccountSelect label="Bank Account" field="bankAccountCode" hint="Used for bank/cheque/card/wallet payments" />
          <AccountSelect label="Trade Receivables" field="receivableAccountCode" hint="DR on sales invoice issue" />
          <AccountSelect label="Trade Payables" field="payableAccountCode" hint="CR on purchase invoice issue" />
          <AccountSelect label="Sales Revenue" field="salesRevenueCode" hint="CR on sales invoice issue" />
          <AccountSelect label="Purchase Expense" field="purchaseExpenseCode" hint="DR on purchase invoice issue" />
          <AccountSelect label="VAT Payable (Output)" field="vatPayableCode" hint="CR for output VAT on sales" />
          <AccountSelect label="VAT Receivable (Input)" field="vatReceivableCode" hint="DR for input VAT on purchases" />
          <AccountSelect label="TDS Receivable" field="tdsReceivableCode" hint="DR for TDS deducted on sales" />
          <AccountSelect label="TDS Payable" field="tdsPayableCode" hint="CR for TDS on purchases" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
