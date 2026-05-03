import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { usePlatformAuth } from './PlatformAuthContext';
import { LayoutDashboard, Building2, Boxes, CreditCard, Receipt, Users, LogOut, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/platform', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/platform/organizations', icon: Building2, label: 'Organizations' },
  { path: '/platform/plans', icon: CreditCard, label: 'Plans' },
  { path: '/platform/billing', icon: Receipt, label: 'Billing' },
  { path: '/platform/modules', icon: Boxes, label: 'Modules' },
  { path: '/platform/users', icon: Users, label: 'Users' },
];

export default function PlatformLayout() {
  const { user, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate('/platform/login');
  }

  function isActive(item) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <div>
              <h1 className="text-lg font-bold">Platform Admin</h1>
              <p className="text-xs text-gray-400">SaaS Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
