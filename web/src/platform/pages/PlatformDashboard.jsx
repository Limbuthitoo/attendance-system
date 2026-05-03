import { useState, useEffect } from 'react';
import { getDashboardStats } from '../api';
import { Building2, Users, Cpu, TrendingUp } from 'lucide-react';

export default function PlatformDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Organizations', value: stats.totalOrgs, icon: Building2, color: 'bg-indigo-500' },
    { label: 'Active Organizations', value: stats.activeOrgs, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Devices', value: stats.totalDevices, icon: Cpu, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Breakdown panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* By Plan */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organizations by Plan</h2>
          <div className="space-y-3">
            {Object.entries(stats.orgsByPlan || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{plan}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-500 h-2.5 rounded-full"
                      style={{ width: `${Math.min(100, (count / Math.max(stats.totalOrgs, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organizations by Status</h2>
          <div className="space-y-3">
            {Object.entries(stats.orgsByStatus || {}).map(([status, count]) => {
              const colors = {
                ACTIVE: 'bg-green-500',
                TRIAL: 'bg-yellow-500',
                SUSPENDED: 'bg-red-500',
                CANCELLED: 'bg-gray-500',
              };
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-600">{status}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent organizations */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Organizations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Organization</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Employees</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats.recentOrgs || []).map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500">{org.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {org.planName || org.plan?.name || 'No Plan'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={org.subscriptionStatus} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{org.employeeCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE: 'bg-green-100 text-green-800',
    TRIAL: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
