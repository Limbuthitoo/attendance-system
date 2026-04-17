import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import DatePicker from '../components/DatePicker';
import {
  ArrowLeft, User, Mail, Phone, Building2, Briefcase, Shield, Clock,
  Calendar, CheckCircle, AlertTriangle, MinusCircle, TrendingUp
} from 'lucide-react';

const STATUS_BADGE = {
  present: { label: 'Present', class: 'bg-emerald-100 text-emerald-700' },
  late: { label: 'Late', class: 'bg-amber-100 text-amber-700' },
  'half-day': { label: 'Half Day', class: 'bg-orange-100 text-orange-700' },
  absent: { label: 'Absent', class: 'bg-red-100 text-red-700' },
};

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attLoading, setAttLoading] = useState(true);

  // Default: last 30 days
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getEmployees();
        const emp = (data.employees || data).find(e => e.id === parseInt(id));
        setEmployee(emp || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const fetchAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const data = await api.getEmployeeAttendance(id, startDate, endDate);
      setAttendance(data.attendance || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
    } finally {
      setAttLoading(false);
    }
  }, [id, startDate, endDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Employee not found</p>
        <button onClick={() => navigate('/employees')} className="text-primary-600 text-sm mt-2">← Back to Employees</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Employee Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold shrink-0">
            {employee.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{employee.name}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">{employee.role}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${employee.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{employee.employee_id}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400" /> {employee.email}
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {employee.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 size={14} className="text-slate-400" /> {employee.department}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Briefcase size={14} className="text-slate-400" /> {employee.designation}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Days', value: summary.totalDays, icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Present', value: summary.presentDays, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Late', value: summary.lateDays, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Half Day', value: summary.halfDays, icon: MinusCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Avg Hours', value: summary.avgHours + 'h', icon: TrendingUp, color: 'text-primary-600', bg: 'bg-primary-50' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 ${s.bg}`}>
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Date Range:</span>
          <div className="flex items-center gap-2">
            <div className="w-44">
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <span className="text-slate-400 text-sm">to</span>
            <div className="w-44">
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => {
                  setStartDate(new Date(Date.now() - p.days * 86400000).toISOString().split('T')[0]);
                  setEndDate(today);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Attendance History</h3>
          <span className="text-xs text-slate-400">{attendance.length} records</span>
        </div>
        {attLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No attendance records</p>
            <p className="text-xs mt-1">Try a different date range</p>
          </div>
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
                {attendance.map(a => {
                  const badge = STATUS_BADGE[a.status] || STATUS_BADGE.present;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTime(a.check_in)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTime(a.check_out)}</td>
                      <td className="px-4 py-3 text-slate-600">{a.work_hours ? `${a.work_hours}h` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.class}`}>{badge.label}</span>
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
