import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Clock, CalendarDays, Users, ClipboardCheck, LogOut, Menu, X, Activity, Settings, UserCircle, CalendarRange, Star, Smartphone, Palette
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/attendance', icon: Clock, label: 'Attendance' },
    { to: '/leaves', icon: CalendarDays, label: 'My Leaves' },
    { to: '/leave-calendar', icon: CalendarRange, label: 'Monthly Calendar' },
    { to: '/activity-log', icon: Activity, label: 'Activity Log' },
    { to: '/profile', icon: UserCircle, label: 'My Profile' },
    ...(user?.role === 'admin'
      ? [
          { to: '/leave-management', icon: ClipboardCheck, label: 'Leave Requests' },
          { to: '/employees', icon: Users, label: 'Employees' },
          { to: '/settings', icon: Settings, label: 'Office Settings' },
          { to: '/holidays', icon: Star, label: 'Holiday Management' },
          { to: '/app-update', icon: Smartphone, label: 'App Update' },
          { to: '/design-tasks', icon: Palette, label: 'Design Tasks' },
        ]
      : []),
  ];

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="Logo" className="w-9 h-9 rounded-lg" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">Archisys</h1>
                <p className="text-xs text-slate-500">Attendance System</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.designation}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 text-slate-600 hover:text-slate-900">
            <Menu size={22} />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && <NotificationBell />}
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 capitalize">
              {user?.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
