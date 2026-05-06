import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { BS_MONTHS, BS_MONTHS_NP, bsToAd } from '../lib/bs-date';
import { Plus, Pencil, Trash2, X, Star, Save } from 'lucide-react';

const CURRENT_YEAR = 2083;

// Convert ISO date string or Date to YYYY-MM-DD for <input type="date">
function toDateInput(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

// Auto-calculate AD date from BS date
function calcAdFromBs(bsYear, bsMonth, bsDay) {
  try {
    const ad = bsToAd(bsYear, bsMonth, bsDay);
    if (ad && !isNaN(ad.getTime())) return ad.toISOString().split('T')[0];
  } catch { /* ignore conversion errors */ }
  return '';
}

// Format AD date for display in table
function formatAdDisplay(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function HolidayManager() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      bs_year: CURRENT_YEAR,
      bs_month: 1,
      bs_day: 1,
      bs_day_end: '',
      bs_month_end: '',
      name: '',
      name_np: '',
      ad_date: '',
      ad_date_end: '',
      women_only: false,
    };
  }

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  async function fetchHolidays() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getHolidays(selectedYear);
      setHolidays(data.holidays || []);
    } catch (err) {
      console.error('Holiday load error:', err);
      setError(err.message || 'Failed to load holidays');
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    const defaultForm = { ...getEmptyForm(), bs_year: selectedYear };
    defaultForm.ad_date = calcAdFromBs(defaultForm.bs_year, defaultForm.bs_month, defaultForm.bs_day);
    setForm(defaultForm);
    setEditing(null);
    setShowForm(true);
    setError('');
  }

  function openEditForm(holiday) {
    setForm({
      bs_year: holiday.bs_year,
      bs_month: holiday.bs_month,
      bs_day: holiday.bs_day,
      bs_day_end: holiday.bs_day_end || '',
      bs_month_end: holiday.bs_month_end || '',
      name: holiday.name,
      name_np: holiday.name_np || '',
      ad_date: toDateInput(holiday.ad_date),
      ad_date_end: toDateInput(holiday.ad_date_end),
      women_only: !!holiday.women_only,
    });
    setEditing(holiday.id);
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        bs_day_end: form.bs_day_end ? parseInt(form.bs_day_end) : null,
        bs_month_end: form.bs_month_end ? parseInt(form.bs_month_end) : null,
        ad_date: form.ad_date || null,
        ad_date_end: form.ad_date_end || null,
      };
      if (editing) {
        await api.updateHoliday(editing, payload);
      } else {
        await api.createHoliday(payload);
      }
      closeForm();
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
      await api.deleteHoliday(id);
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
  }

  function formatBsDate(h) {
    const start = `${BS_MONTHS[h.bs_month - 1]} ${h.bs_day}`;
    if (h.bs_day_end) {
      const endMonth = h.bs_month_end ? BS_MONTHS[h.bs_month_end - 1] : BS_MONTHS[h.bs_month - 1];
      return `${start} – ${endMonth} ${h.bs_day_end}`;
    }
    return start;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holiday Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage public holidays for the fiscal year. Changes reflect in calendar and notice.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {[2082, 2083, 2084, 2085].map(y => (
              <option key={y} value={y}>FY {y} BS</option>
            ))}
          </select>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
          >
            <Plus size={18} />
            Add Holiday
          </button>
        </div>
      </div>

      {error && !showForm && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Holiday List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {holidays.length === 0 ? (
          <div className="text-center py-16">
            <Star size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No holidays defined for FY {selectedYear}.</p>
            <button onClick={openAddForm} className="text-primary-600 hover:underline text-sm mt-2">Add the first holiday</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">#</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Holiday</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">नेपालीमा</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">BS Date</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">AD Date</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h, i) => (
                <tr key={h.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-5 py-3 text-slate-500 font-medium">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{h.name}</td>
                  <td className="px-5 py-3 text-slate-600">{h.name_np || '—'}</td>
                  <td className="px-5 py-3 text-slate-700">{formatBsDate(h)}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {formatAdDisplay(h.ad_date)}
                    {h.ad_date_end ? ` – ${formatAdDisplay(h.ad_date_end)}` : ''}
                  </td>
                  <td className="px-5 py-3">
                    {h.women_only ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">Women Only</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">All</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(h)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(h.id, h.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Holiday' : 'Add Holiday'}</h2>
              <button onClick={closeForm} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Name (English) *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Dashain Festival"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Name (Nepali)</label>
                  <input
                    type="text"
                    value={form.name_np}
                    onChange={e => setForm(f => ({ ...f, name_np: e.target.value }))}
                    placeholder="e.g. दशैं पर्व"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">BS Date (Start) *</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Month</label>
                    <select
                      value={form.bs_month}
                      onChange={e => {
                        const newMonth = parseInt(e.target.value);
                        const ad = calcAdFromBs(form.bs_year, newMonth, form.bs_day);
                        setForm(f => ({ ...f, bs_month: newMonth, ad_date: ad || f.ad_date }));
                      }}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {BS_MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m} ({BS_MONTHS_NP[i]})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Day</label>
                    <input
                      type="number"
                      min="1"
                      max="32"
                      value={form.bs_day}
                      onChange={e => {
                        const newDay = parseInt(e.target.value) || 1;
                        const ad = calcAdFromBs(form.bs_year, form.bs_month, newDay);
                        setForm(f => ({ ...f, bs_day: newDay, ad_date: ad || f.ad_date }));
                      }}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">AD Date (auto-filled)</label>
                    <input
                      type="date"
                      value={form.ad_date}
                      onChange={e => setForm(f => ({ ...f, ad_date: e.target.value }))}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">BS Date (End) — for multi-day holidays</p>
                <p className="text-xs text-slate-400 mb-3">Leave blank for single-day holidays</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">End Month</label>
                    <select
                      value={form.bs_month_end}
                      onChange={e => {
                        const endMonth = e.target.value ? parseInt(e.target.value) : '';
                        const endDay = form.bs_day_end ? parseInt(form.bs_day_end) : '';
                        const ad = endMonth && endDay ? calcAdFromBs(form.bs_year, endMonth, endDay) : '';
                        setForm(f => ({ ...f, bs_month_end: e.target.value, ad_date_end: ad || f.ad_date_end }));
                      }}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Same month</option>
                      {BS_MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">End Day</label>
                    <input
                      type="number"
                      min=""
                      max="32"
                      value={form.bs_day_end}
                      onChange={e => {
                        const endDay = e.target.value;
                        const endMonth = form.bs_month_end ? parseInt(form.bs_month_end) : form.bs_month;
                        const ad = endDay ? calcAdFromBs(form.bs_year, endMonth, parseInt(endDay)) : '';
                        setForm(f => ({ ...f, bs_day_end: endDay, ad_date_end: ad || f.ad_date_end }));
                      }}
                      placeholder="—"
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">AD End Date (auto-filled)</label>
                    <input
                      type="date"
                      value={form.ad_date_end}
                      onChange={e => setForm(f => ({ ...f, ad_date_end: e.target.value }))}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.women_only}
                    onChange={e => setForm(f => ({ ...f, women_only: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Women only holiday (e.g. Teej)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editing ? 'Update' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
