import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, X, Trash2 } from 'lucide-react';
import DatePicker from '../components/DatePicker';

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: '',
    is_half_day: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLeaves();
    loadBalances();
  }, [filter]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await api.getMyLeaves(filter);
      setLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const data = await api.getLeaveBalance();
      setBalances(data.balances || []);
    } catch (err) {
      console.error('Failed to load balances', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.applyLeave(form);
      setShowForm(false);
      setForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '', is_half_day: false });
      loadLeaves();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await api.cancelLeave(id);
      loadLeaves();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Leaves</h2>
          <p className="text-sm text-slate-500 mt-1">Apply and manage your leave requests</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Apply Leave'}
        </button>
      </div>

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {balances.filter(b => b.totalDays > 0 || b.usedDays > 0).map(b => (
            <div key={b.leaveType} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 capitalize mb-1">{b.leaveType.toLowerCase()}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{b.remainingDays}</span>
                <span className="text-xs text-slate-400">/ {b.totalDays}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2">
                <div
                  className="h-1.5 bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (b.remainingDays / b.totalDays) * 100)}%` }}
                />
              </div>
              {b.usedDays > 0 && (
                <p className="text-xs text-slate-400 mt-1">{b.usedDays} used</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leave Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New Leave Application</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Type</label>
              <select
                value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="earned">Earned Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_half_day}
                  onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Half-day leave (0.5 day)</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
              <DatePicker
                value={form.start_date}
                onChange={(v) => setForm({ ...form, start_date: v })}
                placeholder="Select start date"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
              <DatePicker
                value={form.end_date}
                onChange={(v) => setForm({ ...form, end_date: v })}
                placeholder="Select end date"
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="Describe the reason for your leave..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Leave List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500">No leave requests found</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaves.map((leave) => (
              <div key={leave.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900 capitalize">{leave.leave_type} Leave</span>
                    {statusBadge(leave.status)}
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    {new Date(leave.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {leave.start_date !== leave.end_date && ` — ${new Date(leave.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    {' '}&middot; {leave.days} day{leave.days > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-slate-600">{leave.reason}</p>
                  {leave.review_note && (
                    <p className="text-xs text-slate-500 mt-1 italic">Admin note: {leave.review_note}</p>
                  )}
                </div>
                {leave.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(leave.id)}
                    className="text-slate-400 hover:text-red-500 transition p-1"
                    title="Cancel"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
