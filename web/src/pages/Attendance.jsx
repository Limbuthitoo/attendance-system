import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { STATUS_BADGE_STYLES, STATUS_LABELS, getStatusLabel } from '../lib/status-config';
import { LogIn, LogOut, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Attendance() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [month, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [todayData, historyData] = await Promise.all([
        api.getToday(),
        api.getHistory(month, year)
      ]);
      setToday(todayData.attendance);
      setHistory(historyData.attendance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const data = await api.checkIn();
      setToday(data.attendance);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const data = await api.checkOut();
      setToday(data.attendance);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const statusBadge = (status) => {
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE_STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
        {getStatusLabel(status)}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Attendance</h2>
        <p className="text-sm text-slate-500 mt-1">Check in, check out, and view your history</p>
      </div>

      {/* Check In/Out Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {today ? (
              <div className="flex gap-4 mt-2 text-sm text-slate-600">
                <span>In: {today.check_in ? new Date(today.check_in).toLocaleTimeString() : '—'}</span>
                <span>Out: {today.check_out ? new Date(today.check_out).toLocaleTimeString() : '—'}</span>
                {today.work_hours > 0 && <span>Hours: {today.work_hours}h</span>}
                {statusBadge(today.status)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-1">Not checked in yet</p>
            )}
          </div>

          <div className="flex gap-2">
            {(!today || !today.check_in) && (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <LogIn size={16} /> Check In
              </button>
            )}
            {today?.check_in && !today?.check_out && (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <LogOut size={16} /> Check Out
              </button>
            )}
            {today?.check_out && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                <Clock size={16} /> Day complete
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Attendance History</h3>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
              {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={18} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500">No records for this month</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 bg-slate-50">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">{record.check_in ? new Date(record.check_in).toLocaleTimeString() : '—'}</td>
                    <td className="px-4 py-3">{record.check_out ? new Date(record.check_out).toLocaleTimeString() : '—'}</td>
                    <td className="px-4 py-3">{record.work_hours ? `${record.work_hours}h` : '—'}</td>
                    <td className="px-4 py-3">{statusBadge(record.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
