import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Check, X } from 'lucide-react';

export default function LeaveManagement() {
  const { dateFormat } = useSettings();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reviewNote, setReviewNote] = useState({});
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadLeaves();
  }, [filter]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await api.getAllLeaves(filter);
      setLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    setProcessing(id);
    try {
      await api.reviewLeave(id, status, reviewNote[id] || '');
      setReviewNote(prev => { const n = {...prev}; delete n[id]; return n; });
      loadLeaves();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(null);
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
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Leave Requests</h2>
        <p className="text-sm text-slate-500 mt-1">Review and manage employee leave applications</p>
      </div>

      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected', ''].map((f) => (
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
              <div key={leave.id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">{leave.name}</span>
                      <span className="text-xs text-slate-500">{leave.emp_code}</span>
                      {statusBadge(leave.status)}
                    </div>
                    <p className="text-xs text-slate-500">{leave.department}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p className="capitalize font-medium text-slate-700">{leave.leave_type} Leave</p>
                    <p>
                      {formatDate(leave.start_date, dateFormat)}
                      {leave.start_date !== leave.end_date && ` — ${formatDate(leave.end_date, dateFormat)}`}
                      {' '}({leave.days} day{leave.days > 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-3">{leave.reason}</p>

                {leave.status === 'pending' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Add a note (optional)"
                      value={reviewNote[leave.id] || ''}
                      onChange={(e) => setReviewNote(prev => ({...prev, [leave.id]: e.target.value}))}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => handleReview(leave.id, 'approved')}
                      disabled={processing === leave.id}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleReview(leave.id, 'rejected')}
                      disabled={processing === leave.id}
                      className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}

                {leave.review_note && (
                  <p className="text-xs text-slate-500 mt-2 italic">Note: {leave.review_note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
