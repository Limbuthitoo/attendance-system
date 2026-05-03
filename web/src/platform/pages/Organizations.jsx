import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOrganizations, suspendOrganization, reactivateOrganization, getPlans } from '../api';
import { Building2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Organizations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ organizations: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [planFilter, setPlanFilter] = useState(searchParams.get('plan') || '');

  const [plans, setPlans] = useState([]);
  const page = parseInt(searchParams.get('page')) || 1;

  useEffect(() => {
    getPlans().then((d) => setPlans(d.plans || d)).catch(() => {});
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [page, statusFilter, planFilter]);

  async function loadOrgs(searchValue) {
    setLoading(true);
    try {
      const result = await getOrganizations({
        search: searchValue ?? search,
        status: statusFilter,
        plan: planFilter,
        page,
        limit: 15,
      });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearchParams((p) => { p.set('page', '1'); return p; });
    loadOrgs();
  }

  async function handleToggleStatus(org) {
    const action = org.isActive ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} "${org.name}"?`)) return;
    try {
      if (org.isActive) {
        await suspendOrganization(org.id);
      } else {
        await reactivateOrganization(org.id);
      }
      loadOrgs();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <Link
          to="/platform/organizations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Organization
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, slug, or domain..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </form>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRIAL">Trial</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-6 py-3">Organization</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Employees</th>
                <th className="px-6 py-3">Branches</th>
                <th className="px-6 py-3">Devices</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && data.organizations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No organizations found</p>
                  </td>
                </tr>
              )}
              {!loading &&
                data.organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/platform/organizations/${org.id}`} className="group">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                          {org.name}
                        </p>
                        <p className="text-xs text-gray-500">{org.slug}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <PlanBadge plan={org.plan?.name || 'No Plan'} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={org.subscriptionStatus} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {org.employeeCount} / {org.maxEmployees}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {org.branchCount} / {org.maxBranches}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {org.deviceCount} / {org.maxDevices}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(org)}
                        className={`text-xs font-medium px-3 py-1 rounded ${
                          org.isActive
                            ? 'text-red-700 bg-red-50 hover:bg-red-100'
                            : 'text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {org.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing page {data.page} of {data.totalPages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setSearchParams((p) => { p.set('page', String(page - 1)); return p; })}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setSearchParams((p) => { p.set('page', String(page + 1)); return p; })}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanBadge({ plan }) {
  const colorMap = {
    Trial: 'bg-yellow-100 text-yellow-800',
    Starter: 'bg-emerald-100 text-emerald-800',
    Business: 'bg-blue-100 text-blue-800',
    Enterprise: 'bg-purple-100 text-purple-800',
  };
  const style = colorMap[plan] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {plan}
    </span>
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
