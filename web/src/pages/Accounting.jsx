import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const VOUCHER_TYPES = ['JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA', 'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'];

export default function Accounting() {
  const { dateFormat } = useSettings();
  const [tab, setTab] = useState('accounts');
  const tabs = [
    { id: 'accounts', label: 'Chart of Accounts' },
    { id: 'fiscalYears', label: 'Fiscal Years' },
    { id: 'journals', label: 'Journal Entries' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
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
      {tab === 'accounts' && <ChartOfAccountsTab />}
      {tab === 'fiscalYears' && <FiscalYearsTab />}
      {tab === 'journals' && <JournalEntriesTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FISCAL YEARS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function FiscalYearsTab() {
  const { dateFormat } = useSettings();
  const [fiscalYears, setFiscalYears] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const data = await api.getFiscalYears(); setFiscalYears(data); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api.createFiscalYear(form); setShowForm(false); setForm({ name: '', startDate: '', endDate: '', isCurrent: false }); load(); } catch (e) { alert(e.message); }
  };

  const toggleCurrent = async (fy) => {
    try { await api.updateFiscalYear(fy.id, { isCurrent: !fy.isCurrent }); load(); } catch (e) { alert(e.message); }
  };

  const updateStatus = async (fy, status) => {
    try { await api.updateFiscalYear(fy.id, { status }); load(); } catch (e) { alert(e.message); }
  };

  const handleCloseYear = async (fy) => {
    if (!confirm(`Close fiscal year ${fy.name}?\n\nThis will:\n• Create closing journal entries\n• Transfer P&L to Retained Earnings\n• Carry forward opening balances\n• Lock the fiscal year\n\nThis cannot be undone.`)) return;
    try {
      const result = await api.closeFiscalYear(fy.id);
      alert(`Fiscal year ${result.name} closed successfully.\nNet Profit: NPR ${result.netProfit?.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`);
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ New Fiscal Year'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (e.g. 2082/83)</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <DatePicker value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} placeholder="Start Date" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <DatePicker value={form.endDate} onChange={v => setForm({ ...form, endDate: v })} placeholder="End Date" required />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isCurrent} onChange={e => setForm({ ...form, isCurrent: e.target.checked })} className="rounded" />
                <span className="text-sm text-gray-700">Current</span>
              </label>
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 ml-auto">Create</button>
            </div>
          </div>
        </form>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Period</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Current</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {fiscalYears.map(fy => (
              <tr key={fy.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{fy.name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(fy.startDate, dateFormat)} — {formatDate(fy.endDate, dateFormat)}</td>
                <td className="px-5 py-3.5"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${fy.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : fy.status === 'CLOSED' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' : 'bg-red-50 text-red-700 ring-1 ring-red-600/20'}`}>{fy.status}</span></td>
                <td className="px-5 py-3.5">
                  <button onClick={() => toggleCurrent(fy)} className={`text-xs px-2.5 py-1 rounded-md font-medium ${fy.isCurrent ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20' : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100'}`}>
                    {fy.isCurrent ? '★ Active' : 'Set Active'}
                  </button>
                </td>
                <td className="px-5 py-3.5 space-x-2">
                  {fy.status === 'OPEN' && <button onClick={() => handleCloseYear(fy)} className="text-xs text-amber-600 hover:text-amber-700 font-medium">Close Year</button>}
                  {fy.status === 'OPEN' && <button onClick={() => updateStatus(fy, 'LOCKED')} className="text-xs text-red-600 hover:text-red-700 font-medium">Lock</button>}
                  {fy.status === 'CLOSED' && <button onClick={() => updateStatus(fy, 'LOCKED')} className="text-xs text-red-600 hover:text-red-700 font-medium">Lock</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {fiscalYears.length === 0 && <p className="text-center py-8 text-gray-400">No fiscal years. Create one to get started.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ChartOfAccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', nameNp: '', type: 'ASSET', parentId: '', isGroup: false, description: '', openingBalance: 0 });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const data = await api.getAccounts({ type: filterType || undefined }); setAccounts(data); } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType]);
  useEffect(() => { load(); }, [load]);

  const handleSeedDefaults = async () => {
    try { await api.seedDefaultAccounts(); load(); } catch (e) { alert(e.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.updateAccount(editId, form);
      else await api.createAccount(form);
      setShowForm(false); setEditId(null); setForm({ code: '', name: '', nameNp: '', type: 'ASSET', parentId: '', isGroup: false, description: '', openingBalance: 0 }); load();
    } catch (e) { alert(e.message); }
  };

  const handleEdit = (acc) => {
    setForm({ code: acc.code, name: acc.name, nameNp: acc.nameNp || '', type: acc.type, parentId: acc.parentId || '', isGroup: acc.isGroup, description: acc.description || '', openingBalance: Number(acc.openingBalance) });
    setEditId(acc.id); setShowForm(true);
  };

  const handleDelete = async (acc) => {
    if (!confirm(`Delete account ${acc.code} — ${acc.name}?`)) return;
    try { await api.deleteAccount(acc.id); load(); } catch (e) { alert(e.message); }
  };

  const groupAccounts = accounts.filter(a => a.isGroup);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex-1" />
        {accounts.length === 0 && <button onClick={handleSeedDefaults} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">Seed Default Accounts (Nepal)</button>}
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ New Account'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 1103" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (Nepali)</label>
              <input value={form.nameNp} onChange={e => setForm({ ...form, nameNp: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Group</label>
              <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">None (Root)</option>
                {groupAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
              <input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isGroup} onChange={e => setForm({ ...form, isGroup: e.target.checked })} className="rounded" /><span className="text-sm text-gray-700">Group Account (non-postable)</span></label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Parent</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Opening Bal</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {accounts.map(acc => (
              <tr key={acc.id} className={acc.isGroup ? 'bg-blue-50/30 font-medium' : 'hover:bg-blue-50/40 transition-colors'}>
                <td className="px-5 py-3 text-sm text-gray-900 font-mono">{acc.code}</td>
                <td className="px-5 py-3 text-sm text-gray-900">
                  {acc.parent ? <span className="text-gray-300 mr-1">└</span> : ''}{acc.name}
                  {acc.nameNp && <span className="text-gray-400 text-xs ml-2">{acc.nameNp}</span>}
                  {acc.isGroup && <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md ring-1 ring-blue-100">Group</span>}
                </td>
                <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 font-medium rounded-full ${acc.type === 'ASSET' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' : acc.type === 'LIABILITY' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' : acc.type === 'EQUITY' ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20' : acc.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20'}`}>{acc.type}</span></td>
                <td className="px-5 py-3 text-sm text-gray-500">{acc.parent ? `${acc.parent.code} — ${acc.parent.name}` : '—'}</td>
                <td className="px-5 py-3 text-sm text-right text-gray-900 font-mono">{Number(acc.openingBalance).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 space-x-3">
                  <button onClick={() => handleEdit(acc)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  {!acc.isSystem && <button onClick={() => handleDelete(acc)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {accounts.length === 0 && <p className="text-center py-8 text-gray-400">No accounts. Click "Seed Default Accounts" to create the Nepal standard chart.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function JournalEntriesTab() {
  const { dateFormat } = useSettings();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], narration: '', reference: '', voucherType: 'JOURNAL', lines: [{ accountId: '', debit: '', credit: '', narration: '' }, { accountId: '', debit: '', credit: '', narration: '' }] });
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [data, accs] = await Promise.all([api.getJournalEntries({ voucherType: filterType || undefined, status: filterStatus || undefined }), api.getAccounts({ isGroup: false })]);
      setEntries(data); setAccounts(accs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType, filterStatus]);
  useEffect(() => { load(); }, [load]);

  const addLine = () => setForm({ ...form, lines: [...form.lines, { accountId: '', debit: '', credit: '', narration: '' }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) });
  const updateLine = (i, field, val) => { const lines = [...form.lines]; lines[i] = { ...lines[i], [field]: val }; setForm({ ...form, lines }); };

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createJournalEntry({ ...form, lines: form.lines.filter(l => l.accountId) });
      setShowForm(false); setForm({ date: new Date().toISOString().split('T')[0], narration: '', reference: '', voucherType: 'JOURNAL', lines: [{ accountId: '', debit: '', credit: '', narration: '' }, { accountId: '', debit: '', credit: '', narration: '' }] }); load();
    } catch (e) { alert(e.message); }
  };

  const handlePost = async (id) => { try { await api.postJournalEntry(id); load(); } catch (e) { alert(e.message); } };
  const handleVoid = async (id) => { if (confirm('Void this entry?')) { try { await api.voidJournalEntry(id); load(); } catch (e) { alert(e.message); } } };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">All Voucher Types</option>
          {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option><option value="POSTED">Posted</option><option value="VOID">Void</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ New Journal Entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><DatePicker value={form.date} onChange={v => setForm({ ...form, date: v })} placeholder="Date" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label><select value={form.voucherType} onChange={e => setForm({ ...form, voucherType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">{VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reference</label><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Invoice #, Voucher #" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Narration *</label><input value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Description / Particulars" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Lines</h3>
              <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Add Line</button>
            </div>
            <table className="min-w-full">
              <thead><tr>
                <th className="text-left text-xs text-gray-500 pb-1">Account</th>
                <th className="text-right text-xs text-gray-500 pb-1 w-32">Debit (NPR)</th>
                <th className="text-right text-xs text-gray-500 pb-1 w-32">Credit (NPR)</th>
                <th className="text-left text-xs text-gray-500 pb-1">Narration</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-1"><select value={line.accountId} onChange={e => updateLine(i, 'accountId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"><option value="">Select Account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></td>
                    <td className="pr-2 py-1"><input type="number" step="0.01" min="0" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" /></td>
                    <td className="pr-2 py-1"><input type="number" step="0.01" min="0" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" /></td>
                    <td className="pr-2 py-1"><input value={line.narration} onChange={e => updateLine(i, 'narration', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></td>
                    <td className="py-1">{form.lines.length > 2 && <button type="button" onClick={() => removeLine(i)} className="text-red-500 text-xs">✕</button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td className="text-right text-sm font-medium text-gray-700 pr-2 pt-2">Total</td>
                <td className="text-right text-sm font-bold text-gray-900 pr-2 pt-2 font-mono">{totalDebit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                <td className="text-right text-sm font-bold text-gray-900 pr-2 pt-2 font-mono">{totalCredit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                <td className="pt-2"><span className={`text-xs ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(totalDebit - totalCredit) < 0.01 ? '✓ Balanced' : `Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}</span></td>
                <td></td>
              </tr></tfoot>
            </table>
          </div>
          <div className="flex justify-end"><button type="submit" disabled={Math.abs(totalDebit - totalCredit) > 0.01} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">Create Entry</button></div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Narration</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Debit</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {entries.map(entry => (
              <React.Fragment key={entry.id}>
                <tr className="cursor-pointer hover:bg-blue-50/40 transition-colors" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <td className="px-5 py-3 text-sm font-mono text-gray-900">{entry.entryNumber}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{formatDate(entry.date, dateFormat)}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-md ring-1 ring-gray-200 font-medium">{entry.voucherType}</span></td>
                  <td className="px-5 py-3 text-sm text-gray-900">{entry.narration}{entry.reference && <span className="text-gray-400 text-xs ml-2">Ref: {entry.reference}</span>}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-gray-900">{Number(entry.totalDebit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono text-gray-900">{Number(entry.totalCredit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : entry.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' : 'bg-red-50 text-red-700 ring-1 ring-red-600/20'}`}>{entry.status}</span></td>
                  <td className="px-5 py-3 space-x-3">
                    {entry.status === 'DRAFT' && <button onClick={(e) => { e.stopPropagation(); handlePost(entry.id); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Post</button>}
                    {entry.status !== 'VOID' && <button onClick={(e) => { e.stopPropagation(); handleVoid(entry.id); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Void</button>}
                  </td>
                </tr>
                {expandedId === entry.id && (
                  <tr>
                    <td colSpan="8" className="px-8 py-4 bg-slate-50 border-l-4 border-blue-200">
                      <table className="w-full text-sm">
                        <thead><tr><th className="text-left text-xs text-gray-500 pb-2 font-semibold">Account</th><th className="text-right text-xs text-gray-500 pb-2 font-semibold">Debit</th><th className="text-right text-xs text-gray-500 pb-2 font-semibold">Credit</th><th className="text-left text-xs text-gray-500 pb-2 font-semibold">Narration</th></tr></thead>
                        <tbody>{entry.lines.map(l => (<tr key={l.id}><td className="py-1.5 text-gray-700">{l.account.code} — {l.account.name}</td><td className="py-1.5 text-right font-mono">{Number(l.debit) > 0 ? Number(l.debit).toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td><td className="py-1.5 text-right font-mono">{Number(l.credit) > 0 ? Number(l.credit).toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td><td className="py-1.5 text-gray-500">{l.narration || ''}</td></tr>))}</tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
        {entries.length === 0 && <p className="text-center py-8 text-gray-400">No journal entries found.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER TAB
// ═══════════════════════════════════════════════════════════════════════════════

function LedgerTab() {
  const { dateFormat } = useSettings();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getAccounts({ isGroup: false }).then(setAccounts).catch(console.error); }, []);

  const loadLedger = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try { const data = await api.getLedger(selectedAccount); setLedger(data); } catch (e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Account</label>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Choose an account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>)}
          </select>
        </div>
        <button onClick={loadLedger} disabled={!selectedAccount || loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">View Ledger</button>
      </div>

      {ledger && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">{ledger.account.code} — {ledger.account.name}</h3>
            <p className="text-sm text-gray-500">Type: {ledger.account.type} | Opening Balance: NPR {ledger.openingBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entry #</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Narration</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Debit</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              <tr className="bg-amber-50/50"><td colSpan="6" className="px-5 py-2.5 text-sm text-gray-600 italic">Opening Balance</td><td className="px-5 py-2.5 text-right text-sm font-mono font-bold">{ledger.openingBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td></tr>
              {ledger.entries.map((e, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-2.5 text-sm text-gray-600">{formatDate(e.date, dateFormat)}</td>
                  <td className="px-5 py-2.5 text-sm font-mono">{e.entryNumber}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-900">{e.narration}</td>
                  <td className="px-5 py-2.5"><span className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-md ring-1 ring-gray-200 font-medium">{e.voucherType}</span></td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono">{e.debit > 0 ? e.debit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono">{e.credit > 0 ? e.credit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td>
                  <td className="px-5 py-2.5 text-sm text-right font-mono font-bold">{e.balance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold"><td colSpan="6" className="px-5 py-2.5 text-sm text-right">Closing Balance</td><td className="px-5 py-2.5 text-right text-sm font-mono">{ledger.closingBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td></tr>
            </tbody>
          </table>
          </div>
          {ledger.entries.length === 0 && <p className="text-center py-4 text-gray-400">No transactions found for this account.</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ReportsTab() {
  const [report, setReport] = useState('trial-balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (report === 'trial-balance') setData({ type: 'trial-balance', ...(await api.getTrialBalance()) });
      else if (report === 'profit-loss') setData({ type: 'profit-loss', ...(await api.getProfitAndLoss()) });
      else if (report === 'balance-sheet') setData({ type: 'balance-sheet', ...(await api.getBalanceSheet()) });
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report</label>
          <select value={report} onChange={e => setReport(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="trial-balance">Trial Balance</option>
            <option value="profit-loss">Profit & Loss</option>
            <option value="balance-sheet">Balance Sheet</option>
          </select>
        </div>
        <button onClick={loadReport} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{loading ? 'Loading...' : 'Generate'}</button>
      </div>

      {data?.type === 'trial-balance' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Trial Balance — FY {data.fiscalYear}</h3>
            <p className={`text-sm font-medium ${data.balanced ? 'text-emerald-600' : 'text-red-600'}`}>{data.balanced ? '✓ Balanced' : '✗ Not balanced'}</p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Debit (NPR)</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit (NPR)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.rows.map((r, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors"><td className="px-5 py-2.5 text-sm font-mono">{r.code}</td><td className="px-5 py-2.5 text-sm text-gray-900">{r.name}</td><td className="px-5 py-2.5"><span className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 rounded-md ring-1 ring-gray-200 font-medium">{r.type}</span></td><td className="px-5 py-2.5 text-right font-mono">{r.debit > 0 ? r.debit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td><td className="px-5 py-2.5 text-right font-mono">{r.credit > 0 ? r.credit.toLocaleString('en-NP', { minimumFractionDigits: 2 }) : ''}</td></tr>
              ))}
              <tr className="bg-gray-50 font-bold"><td colSpan="3" className="px-5 py-3 text-right text-sm">TOTAL</td><td className="px-5 py-3 text-right font-mono">{data.totalDebit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td><td className="px-5 py-3 text-right font-mono">{data.totalCredit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      )}

      {data?.type === 'profit-loss' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-900">Profit & Loss Statement — FY {data.fiscalYear}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-bold text-green-700 mb-2">INCOME</h4>
              {data.incomeAccounts.map((a, i) => (<div key={i} className="flex justify-between py-1 text-sm"><span>{a.code} — {a.name}</span><span className="font-mono">{a.total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>))}
              <div className="flex justify-between py-2 border-t font-bold mt-2"><span>Total Income</span><span className="font-mono text-green-700">NPR {data.totalIncome.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-700 mb-2">EXPENSES</h4>
              {data.expenseAccounts.map((a, i) => (<div key={i} className="flex justify-between py-1 text-sm"><span>{a.code} — {a.name}</span><span className="font-mono">{a.total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>))}
              <div className="flex justify-between py-2 border-t font-bold mt-2"><span>Total Expenses</span><span className="font-mono text-red-700">NPR {data.totalExpense.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
          <div className={`text-center py-4 border-t text-xl font-bold ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            Net {data.netProfit >= 0 ? 'Profit' : 'Loss'}: NPR {Math.abs(data.netProfit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
          </div>
        </div>
      )}

      {data?.type === 'balance-sheet' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-900">Balance Sheet — FY {data.fiscalYear}</h3>
          <p className={`text-sm ${data.balanced ? 'text-green-600' : 'text-red-600'}`}>{data.balanced ? '✓ Balanced (Assets = Liabilities + Equity)' : '✗ Not balanced'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-bold text-blue-700 mb-2">ASSETS</h4>
              {data.assets.map((a, i) => (<div key={i} className="flex justify-between py-1 text-sm"><span>{a.code} — {a.name}</span><span className="font-mono">{a.total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>))}
              <div className="flex justify-between py-2 border-t font-bold mt-2"><span>Total Assets</span><span className="font-mono">NPR {data.totalAssets.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-700 mb-2">LIABILITIES</h4>
              {data.liabilities.map((a, i) => (<div key={i} className="flex justify-between py-1 text-sm"><span>{a.code} — {a.name}</span><span className="font-mono">{a.total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>))}
              <div className="flex justify-between py-2 border-t font-bold mt-2"><span>Total Liabilities</span><span className="font-mono">NPR {data.totalLiabilities.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
              <h4 className="text-sm font-bold text-purple-700 mb-2 mt-4">EQUITY</h4>
              {data.equity.map((a, i) => (<div key={i} className={`flex justify-between py-1 text-sm ${a.code === 'NET_PL' ? 'italic text-gray-500' : ''}`}><span>{a.code === 'NET_PL' ? a.name : `${a.code} — ${a.name}`}</span><span className="font-mono">{a.total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>))}
              <div className="flex justify-between py-2 border-t font-bold mt-2"><span>Total Equity</span><span className="font-mono">NPR {data.totalEquity.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
