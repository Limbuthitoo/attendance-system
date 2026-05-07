import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import DatePicker from '../components/DatePicker';
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Search, LogIn, LogOut, Filter, UserCheck, UserX, Timer, Calendar, Coffee, AlertOctagon, ArrowDownRight
} from 'lucide-react';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const STATUS_CONFIG = {
  present:  { label: 'Present',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500', icon: CheckCircle },
  late:     { label: 'Late',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500', icon: AlertTriangle },
  'half-day': { label: 'Half Day', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', icon: Timer },
  absent:   { label: 'Absent',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200', dot: 'bg-red-500', icon: XCircle },
  'on-leave': { label: 'On Leave', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500', icon: Calendar },
  holiday:  { label: 'Holiday',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200', dot: 'bg-blue-500', icon: Coffee },
  'weekly-off': { label: 'Weekly Off', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500', icon: Coffee },
  'missing-checkout': { label: 'Missing Checkout', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', icon: AlertOctagon },
  'early-exit': { label: 'Early Exit', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', dot: 'bg-pink-500', icon: ArrowDownRight },
};

export default function EmployeeAttendance() {
  // Use Nepal timezone for "today" to match server behavior
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState({ attendance: [], summary: {}, departments: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [date, deptFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      let url = `/attendance/all?date=${date}`;
      if (deptFilter) url += `&department=${encodeURIComponent(deptFilter)}`;
      const res = await api._request(url);
      setData(res);
    } catch {
      setData({ attendance: [], summary: { total: 0, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, holiday: 0, weeklyOff: 0, missingCheckout: 0, earlyExit: 0 }, departments: [] });
    } finally {
      setLoading(false);
    }
  }

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  const filtered = data.attendance.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name?.toLowerCase().includes(q) ||
             a.emp_code?.toLowerCase().includes(q) ||
             a.department?.toLowerCase().includes(q) ||
             a.designation?.toLowerCase().includes(q);
    }
    return true;
  });

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">Daily attendance overview for all employees</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronLeft size={18} />
          </button>
          <div className="w-48">
            <DatePicker value={date} onChange={setDate} />
          </div>
          <button onClick={() => shiftDate(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setDate(todayStr)}
            className="px-3 py-2 text-xs font-semibold bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition"
          >
            Today
          </button>
        </div>
      </div>

      {/* Date label */}
      <p className="text-sm font-medium text-slate-600">{formatDateLabel(date)}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { key: 'all', label: 'Total', value: summary.total, icon: Users, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
          { key: 'present', label: 'Present', value: summary.present, icon: UserCheck, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { key: 'late', label: 'Late', value: summary.late, icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { key: 'half-day', label: 'Half Day', value: summary.halfDay, icon: Timer, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
          { key: 'absent', label: 'Absent', value: summary.absent, icon: UserX, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
          { key: 'on-leave', label: 'On Leave', value: summary.onLeave, icon: Calendar, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
          { key: 'early-exit', label: 'Early Exit', value: summary.earlyExit, icon: ArrowDownRight, color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
          { key: 'missing-checkout', label: 'Missing C/O', value: summary.missingCheckout, icon: AlertOctagon, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
        ].map(card => {
          const Icon = card.icon;
          const isActive = statusFilter === card.key || (card.key === 'all' && statusFilter === 'all');
          return (
            <button
              key={card.key}
              onClick={() => setStatusFilter(statusFilter === card.key ? 'all' : card.key === 'all' ? 'all' : card.key)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                isActive ? `${card.border} ${card.bg} shadow-sm ring-1 ring-offset-0 ${card.border}` : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon size={18} className={card.color} />
              </div>
              <div className="text-left">
                <p className="text-xl font-bold text-slate-900">{card.value || 0}</p>
                <p className="text-[11px] text-slate-500 font-medium">{card.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, code, dept, designation..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        {data.departments.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All Departments</option>
              {data.departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
        <div className="text-sm text-slate-500 self-center ml-auto">
          Showing {filtered.length} of {data.attendance.length} employees
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No employees found</p>
            <p className="text-xs mt-1">Try changing the date or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check In</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check Out</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hours</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(emp => {
                  const cfg = STATUS_CONFIG[emp.status] || STATUS_CONFIG.absent;
                  const Icon = cfg.icon;
                  return (
                    <tr key={emp.employee_id} className="hover:bg-slate-50 transition-colors">
                      {/* Employee */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {emp.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                            <p className="text-xs text-slate-400">{emp.emp_code}{emp.designation ? ` · ${emp.designation}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      {/* Department */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-slate-600">{emp.department}</span>
                      </td>
                      {/* Check In */}
                      <td className="px-5 py-3.5 text-center">
                        {emp.check_in ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200">
                            <LogIn size={13} className="text-green-600" />
                            <span className="text-sm font-semibold text-green-700">{formatTime(emp.check_in)}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      {/* Check Out */}
                      <td className="px-5 py-3.5 text-center">
                        {emp.check_out ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                            <LogOut size={13} className="text-blue-600" />
                            <span className="text-sm font-semibold text-blue-700">{formatTime(emp.check_out)}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      {/* Hours */}
                      <td className="px-5 py-3.5 text-center">
                        {emp.work_hours ? (
                          <span className="text-sm font-bold text-slate-700">{emp.work_hours}h</span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
