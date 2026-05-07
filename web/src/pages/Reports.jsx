import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  BarChart3, TrendingUp, Clock, AlertTriangle, Download, Calendar, Users, Building2,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const todayStr = today.toISOString().slice(0, 10);

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Reports() {
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [tab, setTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  // Data states
  const [summary, setSummary] = useState(null);
  const [deptReport, setDeptReport] = useState([]);
  const [trend, setTrend] = useState([]);
  const [lateArrivals, setLateArrivals] = useState([]);

  useEffect(() => {
    api.getBranches().then(d => setBranches(d.branches || [])).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, deptData, trendData, lateData] = await Promise.all([
        api.getAttendanceSummary({ startDate, endDate, branchId }),
        api.getDepartmentReport(startDate, endDate),
        api.getDailyTrend(startDate, endDate, branchId),
        api.getLateArrivals(startDate, endDate, 2),
      ]);
      setSummary(summaryData);
      setDeptReport(deptData.departments || []);
      setTrend(trendData.trend || []);
      setLateArrivals(lateData.employees || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [startDate, endDate, branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = async () => {
    try {
      const blob = await api.exportAttendanceCsv(startDate, endDate, branchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'trend', label: 'Daily Trend', icon: TrendingUp },
    { id: 'late', label: 'Late Arrivals', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Attendance insights, department breakdowns, and trends</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <Filter size={16} className="text-slate-400" />
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Present" value={summary.totals.present} sub={`of ${summary.employeeCount} employees`} icon={Users} color="green" />
          <StatCard label="Late Arrivals" value={summary.totals.late} icon={Clock} color="amber" />
          <StatCard label="Half Days" value={summary.totals.halfDay} icon={Calendar} color="purple" />
          <StatCard label="Early Exits" value={summary.totals.earlyExit || 0} icon={Clock} color="pink" />
          <StatCard label="Absent" value={summary.totals.absent} icon={AlertTriangle} color="red" />
          <StatCard label="Total Hours" value={Math.round(summary.totals.totalHours).toLocaleString()} sub="work hours logged" icon={BarChart3} color="blue" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-center py-8 text-slate-500">Loading...</div>}

      {/* Summary Tab */}
      {!loading && tab === 'summary' && summary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Department</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Present</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Late</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Half Day</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Early Exit</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Absent</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Total Hours</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Avg Hours</th>
                </tr>
              </thead>
              <tbody>
                {summary.employees.map(emp => (
                  <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm">{emp.name}</div>
                      <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.department}</td>
                    <td className="py-3 px-4 text-center text-sm font-medium text-green-700">{emp.present}</td>
                    <td className="py-3 px-4 text-center text-sm font-medium text-amber-700">{emp.late}</td>
                    <td className="py-3 px-4 text-center text-sm font-medium text-purple-700">{emp.halfDay}</td>
                    <td className="py-3 px-4 text-center text-sm font-medium text-pink-700">{emp.earlyExit || 0}</td>
                    <td className="py-3 px-4 text-center text-sm font-medium text-red-700">{emp.absent}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium">{emp.totalHours}h</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-500">{emp.avgHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {!loading && tab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deptReport.map(dept => (
            <div key={dept.department} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">{dept.department}</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{dept.employeeCount} employees</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Present</span>
                  <span className="font-medium text-green-700">{dept.present}</span>
                </div>
                <MiniBar value={dept.present} max={dept.present + dept.halfDay + dept.absent} color="bg-green-500" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Late</span>
                  <span className="font-medium text-amber-700">{dept.late}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Hours</span>
                  <span className="font-medium">{dept.totalHours}h</span>
                </div>
              </div>
            </div>
          ))}
          {deptReport.length === 0 && (
            <div className="col-span-2 text-center py-16 text-slate-500">No department data for this period</div>
          )}
        </div>
      )}

      {/* Daily Trend Tab */}
      {!loading && tab === 'trend' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          {trend.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No data for this period</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500 uppercase mb-2 px-2">
                <span>Date</span>
                <span className="text-center">Total</span>
                <span className="text-center">Present</span>
                <span className="text-center">Late</span>
                <span className="text-center">Half Day</span>
                <span className="text-center">Early Exit</span>
                <span className="text-center">Absent</span>
              </div>
              {trend.map(day => (
                <div key={day.date} className="grid grid-cols-7 gap-2 items-center px-2 py-2 rounded-lg hover:bg-slate-50">
                  <span className="text-sm font-medium">{new Date(day.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="text-center text-sm font-bold">{day.total}</span>
                  <span className="text-center text-sm text-green-700">{day.present}</span>
                  <span className="text-center text-sm text-amber-700">{day.late}</span>
                  <span className="text-center text-sm text-purple-700">{day.halfDay}</span>
                  <span className="text-center text-sm text-pink-700">{day.earlyExit || 0}</span>
                  <span className="text-center text-sm text-red-700">{day.absent}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Late Arrivals Tab */}
      {!loading && tab === 'late' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {lateArrivals.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No frequent late arrivals in this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Late Count</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Late Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {lateArrivals.map(emp => (
                    <tr key={emp.employeeId} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 px-4">
                        <div className="font-medium text-sm">{emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{emp.department}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{emp.lateCount}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {emp.dates.slice(0, 5).join(', ')}{emp.dates.length > 5 ? ` +${emp.dates.length - 5} more` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
