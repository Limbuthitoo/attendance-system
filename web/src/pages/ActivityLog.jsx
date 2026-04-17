import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  LogIn, LogOut, CreditCard, CalendarDays, CheckCircle, XCircle,
  AlertTriangle, Filter, ChevronLeft, ChevronRight, Search, Clock
} from 'lucide-react';
import DatePicker from '../components/DatePicker';

const TYPE_CONFIG = {
  attendance:     { icon: Clock,          label: 'Attendance',      color: 'text-green-600',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  nfc_tap:        { icon: CreditCard,     label: 'NFC Tap',         color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  leave_applied:  { icon: CalendarDays,   label: 'Leave Applied',   color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  leave_approved: { icon: CheckCircle,    label: 'Leave Approved',  color: 'text-emerald-600',bg: 'bg-emerald-50',dot: 'bg-emerald-500' },
  leave_rejected: { icon: XCircle,        label: 'Leave Rejected',  color: 'text-red-600',    bg: 'bg-red-50',    dot: 'bg-red-500' },
};

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDateLabel(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// Merge check_in and check_out into single attendance rows
function mergeActivities(activities) {
  const attendanceMap = {};
  const others = [];

  for (const a of activities) {
    if (a.type === 'check_in' || a.type === 'check_out') {
      const key = `${a.employeeId}_${a.time?.split('T')[0] || ''}`;
      if (!attendanceMap[key]) {
        attendanceMap[key] = {
          type: 'attendance',
          employee: a.employee,
          empCode: a.empCode,
          department: a.department,
          employeeId: a.employeeId,
          checkIn: null,
          checkOut: null,
          status: null,
          workHours: null,
          method: a.method,
          time: a.time,
        };
      }
      if (a.type === 'check_in') {
        attendanceMap[key].checkIn = a.time;
        attendanceMap[key].status = a.status;
        attendanceMap[key].time = a.time; // sort by check-in time
      }
      if (a.type === 'check_out') {
        attendanceMap[key].checkOut = a.time;
        attendanceMap[key].workHours = a.workHours;
        if (!attendanceMap[key].method && a.method) attendanceMap[key].method = a.method;
      }
    } else {
      others.push(a);
    }
  }

  const merged = [...Object.values(attendanceMap), ...others];
  merged.sort((a, b) => new Date(b.time) - new Date(a.time));
  return merged;
}

function getDescription(a) {
  switch (a.type) {
    case 'attendance':
      return `${a.employee} — In: ${formatTime(a.checkIn)} → Out: ${formatTime(a.checkOut)}${a.workHours ? ` (${a.workHours}h)` : ''}${a.status === 'late' ? ' · Late' : ''}`;
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

  const todayStr = new Date().toISOString().split('T')[0];
  const [mode, setMode] = useState('single'); // 'single' or 'range'
  const [date, setDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
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
  }, [date, startDate, endDate, selectedEmployee, mode]);

  async function fetchActivities() {
    setLoading(true);
    try {
      let url;
      if (mode === 'range') {
        url = `/dashboard/activity-log?start_date=${startDate}&end_date=${endDate}`;
      } else {
        url = `/dashboard/activity-log?date=${date}`;
      }
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

  const merged = mergeActivities(activities);

  const filtered = merged.filter(a => {
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
  for (const a of merged) {
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

        {/* Date mode toggle + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-2 transition ${mode === 'single' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Day
            </button>
            <button
              onClick={() => { setMode('range'); setStartDate(date); setEndDate(date); }}
              className={`px-3 py-2 transition ${mode === 'range' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Range
            </button>
          </div>

          {mode === 'single' ? (
            <>
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
              <div className="w-48">
                <DatePicker value={date} onChange={v => setDate(v)} />
              </div>
              <button onClick={() => shiftDate(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
              <button
                onClick={() => setDate(todayStr)}
                className="px-3 py-2 text-xs font-medium bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
              >
                Today
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-40"><DatePicker value={startDate} onChange={setStartDate} placeholder="Start" /></div>
              <span className="text-slate-400 text-sm">to</span>
              <div className="w-40"><DatePicker value={endDate} onChange={setEndDate} placeholder="End" /></div>
              {[
                { label: '7D', days: 7 },
                { label: '30D', days: 30 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => { setStartDate(new Date(Date.now() - p.days * 86400000).toISOString().split('T')[0]); setEndDate(todayStr); }}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
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
          <option value="all">All Types ({merged.length})</option>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
      {mode === 'single' && (
        <div className="text-sm font-medium text-slate-600">{formatDateLabel(date)}</div>
      )}

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
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.attendance;
              const Icon = cfg.icon;
              return (
                <div key={i} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  {/* Icon */}
                  <div className={`p-2 rounded-xl ${cfg.bg} mt-0.5`}>
                    <Icon size={18} className={cfg.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{a.employee || 'Unknown'}</span>
                      {a.empCode && <span className="text-xs text-slate-400 font-mono">{a.empCode}</span>}
                      {a.department && <span className="text-xs text-slate-400">· {a.department}</span>}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {a.type === 'attendance' && a.status === 'late' && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">LATE</span>
                      )}
                    </div>

                    {a.type === 'attendance' ? (
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><LogIn size={12} className="text-green-500" /> {formatTime(a.checkIn)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="flex items-center gap-1"><LogOut size={12} className="text-blue-500" /> {formatTime(a.checkOut)}</span>
                        {a.workHours && <span className="text-slate-600 font-medium">{a.workHours}h</span>}
                        {a.method && <span className={a.method === 'NFC' ? 'text-indigo-500' : 'text-slate-400'}>{a.method}</span>}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 mt-0.5">{getDescription(a)}</p>
                        {a.type === 'leave_applied' && a.reason && (
                          <p className="text-xs text-slate-400 mt-1 italic">"{a.reason}"</p>
                        )}
                        {a.reviewNote && (
                          <p className="text-xs text-slate-400 mt-1 italic">Note: "{a.reviewNote}"</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-medium text-slate-500">{formatTime(a.time)}</span>
                    {mode === 'range' && (
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {new Date(a.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
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
