import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  LogIn, LogOut, CreditCard, CalendarDays, CheckCircle, XCircle,
  AlertTriangle, Filter, ChevronLeft, ChevronRight, Search
} from 'lucide-react';

const TYPE_CONFIG = {
  check_in:       { icon: LogIn,         label: 'Checked In',      color: 'text-green-600',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  check_out:      { icon: LogOut,         label: 'Checked Out',     color: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  nfc_tap:        { icon: CreditCard,     label: 'NFC Tap',         color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  leave_applied:  { icon: CalendarDays,   label: 'Leave Applied',   color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  leave_approved: { icon: CheckCircle,    label: 'Leave Approved',  color: 'text-emerald-600',bg: 'bg-emerald-50',dot: 'bg-emerald-500' },
  leave_rejected: { icon: XCircle,        label: 'Leave Rejected',  color: 'text-red-600',    bg: 'bg-red-50',    dot: 'bg-red-500' },
};

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getDescription(a) {
  switch (a.type) {
    case 'check_in':
      return `${a.employee} checked in${a.status === 'late' ? ' (Late)' : ''} via ${a.method}`;
    case 'check_out':
      return `${a.employee} checked out via ${a.method}${a.workHours ? ` — ${a.workHours}h worked` : ''}`;
    case 'nfc_tap':
      return `${a.employee || 'Unknown'} — ${a.result?.replace(/_/g, ' ')}${a.cardUid ? ` (Card: ${a.cardUid})` : ''}`;
    case 'leave_applied':
      return `${a.employee} applied for ${a.days}d ${a.leaveType} leave (${a.startDate} → ${a.endDate})`;
    case 'leave_approved':
      return `${a.employee}'s ${a.leaveType} leave approved${a.reviewerName ? ` by ${a.reviewerName}` : ''}`;
    case 'leave_rejected':
      return `${a.employee}'s ${a.leaveType} leave rejected${a.reviewerName ? ` by ${a.reviewerName}` : ''}`;
    default:
      return a.type;
  }
}

export default function ActivityLog() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api.getEmployees().then(data => setEmployees(data.employees || data || [])).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchActivities();
  }, [date, selectedEmployee]);

  async function fetchActivities() {
    setLoading(true);
    try {
      let url = `/dashboard/activity-log?date=${date}`;
      if (selectedEmployee) url += `&employee_id=${selectedEmployee}`;
      const data = await api._request(url);
      setActivities(data.activities || []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  const filtered = activities.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (a.employee || '').toLowerCase().includes(q) ||
             (a.empCode || '').toLowerCase().includes(q) ||
             (a.department || '').toLowerCase().includes(q);
    }
    return true;
  });

  const typeCounts = {};
  for (const a of activities) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'Track all employee activities, NFC taps, and leave events' : 'Your activity history'}
          </p>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={() => shiftDate(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
          <button
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs font-medium bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
              ))}
            </select>
          </div>
        )}

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Types ({activities.length})</option>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            typeCounts[key] ? <option key={key} value={key}>{cfg.label} ({typeCounts[key]})</option> : null
          ))}
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, code, dept..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = typeCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                typeFilter === key ? 'border-primary-300 bg-primary-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                <Icon size={16} className={cfg.color} />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-slate-900">{count}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{cfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date label */}
      <div className="text-sm font-medium text-slate-600">{formatDate(date)}</div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No activities found</p>
            <p className="text-xs mt-1">Try a different date or filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((a, i) => {
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.check_in;
              const Icon = cfg.icon;
              return (
                <div key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-1">
                    <div className={`p-2 rounded-xl ${cfg.bg}`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    {i < filtered.length - 1 && (
                      <div className="w-px h-full bg-slate-200 mt-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm font-semibold text-slate-800">{a.employee || 'Unknown'}</span>
                      {a.empCode && <span className="text-xs text-slate-400 font-mono">{a.empCode}</span>}
                      {a.department && <span className="text-xs text-slate-400">• {a.department}</span>}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{getDescription(a)}</p>
                    {a.type === 'leave_applied' && a.reason && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{a.reason}"</p>
                    )}
                    {a.reviewNote && (
                      <p className="text-xs text-slate-400 mt-1 italic">Note: "{a.reviewNote}"</p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-medium text-slate-500">{formatTime(a.time)}</span>
                    {a.type === 'check_in' && a.status === 'late' && (
                      <span className="block text-[10px] font-bold text-orange-600 mt-0.5">LATE</span>
                    )}
                    {a.method && (
                      <span className={`block text-[10px] mt-0.5 ${a.method === 'NFC' ? 'text-indigo-500' : 'text-slate-400'}`}>{a.method}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
