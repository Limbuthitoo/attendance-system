import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Users, UserCheck, Clock, CalendarX, AlertTriangle, Timer, TrendingUp, Building2, PieChart as PieIcon } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = {
  present: '#10b981', late: '#f59e0b', absent: '#ef4444', halfDay: '#6366f1', earlyExit: '#ec4899',
  sick: '#ef4444', casual: '#3b82f6', earned: '#10b981', unpaid: '#94a3b8', other: '#8b5cf6'
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#3b82f6'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [deptStats, setDeptStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safe = (p) => p.catch(() => null);
    const loads = [
      safe(api.getStats()).then(setStats),
      safe(api.getWeeklyTrend(14)).then(setTrend),
      safe(api.getLeaveStats()).then(setLeaveStats),
    ];
    if (user.role === 'admin') {
      loads.push(safe(api.getDepartmentStats()).then(setDeptStats));
    }
    Promise.all(loads)
      .finally(() => setLoading(false));
  }, [user.role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (user.role === 'admin') {
    return <AdminDashboard stats={stats} trend={trend} deptStats={deptStats} leaveStats={leaveStats} />;
  }

  return <EmployeeDashboard stats={stats} trend={trend} leaveStats={leaveStats} user={user} />;
}

// ─── Admin Dashboard ────────────────────────────────────────────────────────

function AdminDashboard({ stats, trend, deptStats, leaveStats }) {
  const cards = [
    { label: 'Total Employees', value: stats?.totalEmployees || 0, icon: Users, color: 'bg-blue-500', text: 'text-blue-600' },
    { label: 'Present Today', value: stats?.presentToday || 0, icon: UserCheck, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { label: 'Late Today', value: stats?.lateToday || 0, icon: AlertTriangle, color: 'bg-amber-500', text: 'text-amber-600' },
    { label: 'On Leave', value: stats?.onLeaveToday || 0, icon: CalendarX, color: 'bg-red-500', text: 'text-red-600' },
    { label: 'Absent', value: stats?.absentToday || 0, icon: Users, color: 'bg-slate-500', text: 'text-slate-600' },
    { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: Clock, color: 'bg-purple-500', text: 'text-purple-600' },
  ];

  // Today's donut data
  const todayDonut = [
    { name: 'Present', value: (stats?.presentToday || 0) - (stats?.lateToday || 0) },
    { name: 'Late', value: stats?.lateToday || 0 },
    { name: 'Absent', value: stats?.absentToday || 0 },
    { name: 'On Leave', value: stats?.onLeaveToday || 0 },
    { name: 'Early Exit', value: stats?.earlyExitToday || 0 },
  ].filter(d => d.value > 0);

  const donutColors = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

  // Trend data formatting
  const trendData = (trend?.trend || []).map(r => ({
    date: formatShortDate(r.date),
    Present: r.present,
    Late: r.late,
    Absent: r.absent + (r.halfDay || 0),
    'Early Exit': r.earlyExit || 0,
  }));

  // Department data
  const deptData = (deptStats?.departments || []).map(d => ({
    name: d.department,
    rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
    present: d.present,
    total: d.total,
  }));

  // Leave distribution
  const leaveData = (leaveStats?.byType || []).map(l => ({
    name: capitalize(l.type),
    value: l.count,
    days: l.totalDays,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Admin Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Overview of today's attendance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`${card.color} rounded-lg p-1.5 text-white`}>
                <card.icon size={14} />
              </div>
              <p className="text-xs text-slate-500 leading-tight">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Row: Attendance Trend + Today's Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Attendance Trend" subtitle="Last 14 days" icon={TrendingUp} className="lg:col-span-2">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Present" stroke="#10b981" fill="url(#gPresent)" strokeWidth={2} />
                <Area type="monotone" dataKey="Late" stroke="#f59e0b" fill="url(#gLate)" strokeWidth={2} />
                <Area type="monotone" dataKey="Absent" stroke="#ef4444" fill="#ef444410" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Today's Breakdown" icon={PieIcon}>
          {todayDonut.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={todayDonut}
                  cx="50%" cy="45%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {todayDonut.map((_, i) => (
                    <Cell key={i} fill={donutColors[i % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No attendance data today" />}
        </ChartCard>
      </div>

      {/* Row: Department Stats + Leave Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Department Attendance" subtitle="Today's rate" icon={Building2}>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, deptData.length * 44)}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, _, entry) => [`${val}% (${entry.payload.present}/${entry.payload.total})`, 'Attendance']}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={22}>
                  {deptData.map((d, i) => (
                    <Cell key={i} fill={d.rate >= 80 ? '#10b981' : d.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No department data" />}
        </ChartCard>

        <ChartCard title="Leave Distribution" subtitle={`${new Date().getFullYear()} approved leaves`} icon={CalendarX}>
          {leaveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={leaveData}
                  cx="50%" cy="45%"
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  stroke="none"
                >
                  {leaveData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, name, entry) => [`${val} leaves (${entry.payload.days} days)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No approved leaves this year" />}
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Employee Dashboard ─────────────────────────────────────────────────────

function EmployeeDashboard({ stats, trend, leaveStats, user }) {
  const todayRecord = stats?.today;
  const monthStats = {};
  (stats?.monthAttendance || []).forEach(s => { monthStats[s.status] = s.count; });

  const cards = [
    { label: 'Present', value: monthStats.present || 0, icon: UserCheck, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { label: 'Late', value: monthStats.late || 0, icon: AlertTriangle, color: 'bg-amber-500', text: 'text-amber-600' },
    { label: 'Absent', value: monthStats.absent || 0, icon: CalendarX, color: 'bg-red-500', text: 'text-red-600' },
    { label: 'Work Hours', value: `${stats?.totalWorkHours || 0}h`, icon: Timer, color: 'bg-blue-500', text: 'text-blue-600' },
    { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: Clock, color: 'bg-purple-500', text: 'text-purple-600' },
    { label: 'Approved Leaves', value: stats?.approvedLeaves || 0, icon: CalendarX, color: 'bg-teal-500', text: 'text-teal-600' },
  ];

  // Monthly attendance donut
  const monthDonut = [
    { name: 'Present', value: monthStats.present || 0 },
    { name: 'Late', value: monthStats.late || 0 },
    { name: 'Absent', value: monthStats.absent || 0 },
  ].filter(d => d.value > 0);

  // Work hours bar data
  const hoursData = (trend?.trend || []).map(r => ({
    date: formatShortDate(r.date),
    hours: r.work_hours || 0,
    status: r.status,
  }));

  // Check-in time trend
  const checkinData = (trend?.trend || []).filter(r => r.check_in_time).map(r => {
    const [h, m] = r.check_in_time.split(':');
    return {
      date: formatShortDate(r.date),
      time: parseFloat(h) + parseFloat(m) / 60,
      display: `${h}:${m}`,
    };
  });

  // Leave breakdown
  const leaveData = (leaveStats?.byType || []).map(l => ({
    name: capitalize(l.type),
    value: l.count,
    days: l.totalDays,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h2>
        <p className="text-sm text-slate-500 mt-1">{user.department} &middot; {user.designation}</p>
      </div>

      {/* Today's Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Today's Status</h3>
        {todayRecord ? (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-500">Check In</p>
              <p className="text-sm font-medium">{todayRecord.check_in ? new Date(todayRecord.check_in).toLocaleTimeString() : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Check Out</p>
              <p className="text-sm font-medium">{todayRecord.check_out ? new Date(todayRecord.check_out).toLocaleTimeString() : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                todayRecord.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                todayRecord.status === 'late' ? 'bg-amber-100 text-amber-700' :
                todayRecord.status === 'absent' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
              }`}>{todayRecord.status}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Work Hours</p>
              <p className="text-sm font-medium">{todayRecord.work_hours ? `${todayRecord.work_hours}h` : '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not checked in yet</p>
        )}
      </div>

      {/* Stat Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">This Month</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`${card.color} rounded-lg p-1.5 text-white`}>
                  <card.icon size={14} />
                </div>
                <p className="text-xs text-slate-500 leading-tight">{card.label}</p>
              </div>
              <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Row: Work Hours + Monthly Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Daily Work Hours" subtitle="Last 14 days" icon={Timer} className="lg:col-span-2">
          {hoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hoursData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="h" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val) => [`${val}h`, 'Work Hours']}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]} barSize={28}>
                  {hoursData.map((d, i) => (
                    <Cell key={i} fill={d.status === 'late' ? '#f59e0b' : d.status === 'absent' ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Monthly Attendance" icon={PieIcon}>
          {monthDonut.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={monthDonut}
                  cx="50%" cy="45%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {monthDonut.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.name.toLowerCase()] || PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No attendance data" />}
        </ChartCard>
      </div>

      {/* Row: Check-in Trend + Leave Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Check-in Time" subtitle="Last 14 days" icon={TrendingUp}>
          {checkinData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={checkinData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  domain={[7, 12]}
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, _, entry) => [entry.payload.display, 'Check-in']}
                />
                <Line type="monotone" dataKey="time" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="My Check-in" />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No check-in data" />}
        </ChartCard>

        <ChartCard title="Leave Breakdown" subtitle={`${new Date().getFullYear()}`} icon={CalendarX}>
          {leaveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={leaveData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, _, entry) => [`${val} leaves (${entry.payload.days} days)`, '']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {leaveData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No leaves this year" />}
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function ChartCard({ title, subtitle, icon: Icon, className = '', children }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={16} className="text-slate-400" />}
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text = 'No data available' }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-slate-400">
      {text}
    </div>
  );
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
