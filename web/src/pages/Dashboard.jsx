import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Users, UserCheck, Clock, CalendarX, AlertTriangle, Timer } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (user.role === 'admin') {
    return <AdminDashboard stats={stats} />;
  }

  return <EmployeeDashboard stats={stats} user={user} />;
}

function AdminDashboard({ stats }) {
  const cards = [
    { label: 'Total Employees', value: stats?.totalEmployees || 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Present Today', value: stats?.presentToday || 0, icon: UserCheck, color: 'bg-emerald-500' },
    { label: 'Late Today', value: stats?.lateToday || 0, icon: AlertTriangle, color: 'bg-amber-500' },
    { label: 'On Leave', value: stats?.onLeaveToday || 0, icon: CalendarX, color: 'bg-red-500' },
    { label: 'Absent', value: stats?.absentToday || 0, icon: UserCheck, color: 'bg-slate-500' },
    { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: Clock, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Admin Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Overview of today's attendance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
            <div className={`${card.color} rounded-lg p-2.5 text-white`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeDashboard({ stats, user }) {
  const todayRecord = stats?.today;

  const monthStats = {};
  (stats?.monthAttendance || []).forEach(s => { monthStats[s.status] = s.count; });

  const cards = [
    { label: 'Present Days', value: monthStats.present || 0, icon: UserCheck, color: 'bg-emerald-500' },
    { label: 'Late Days', value: monthStats.late || 0, icon: AlertTriangle, color: 'bg-amber-500' },
    { label: 'Absent Days', value: monthStats.absent || 0, icon: CalendarX, color: 'bg-red-500' },
    { label: 'Work Hours', value: `${stats?.totalWorkHours || 0}h`, icon: Timer, color: 'bg-blue-500' },
    { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: Clock, color: 'bg-purple-500' },
    { label: 'Approved Leaves', value: stats?.approvedLeaves || 0, icon: CalendarX, color: 'bg-teal-500' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h2>
        <p className="text-sm text-slate-500 mt-1">{user.department} &middot; {user.designation}</p>
      </div>

      {/* Today's status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
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

      {/* Monthly stats */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">This Month</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
            <div className={`${card.color} rounded-lg p-2.5 text-white`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
