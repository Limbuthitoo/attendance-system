import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Clock, CalendarDays, Users, ClipboardCheck, LogOut, Menu, X, Activity, Settings, UserCircle, CalendarRange, Star, Smartphone, Megaphone, ClipboardList, MapPin, Shield, BarChart3, DollarSign, Navigation, CreditCard, FileText, ChevronDown, Lock, HelpCircle
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, enabledModules, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLogo, setSidebarLogo] = useState('/favicon.svg');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

  function updateFavicon(url) {
    // Remove all existing favicon links
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
    // Also set shortcut icon for older browsers
    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.href = url;
    document.head.appendChild(shortcut);
  }

  useEffect(() => {
    // Load logo from API (pass auth token for org context)
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${apiBase}/settings/branding/logo`, { headers }).then(async r => {
      if (r.ok) {
        const blob = await r.blob();
        setSidebarLogo(URL.createObjectURL(blob));
      }
    }).catch(() => {});
    // Load favicon from API
    fetch(`${apiBase}/settings/branding/favicon`, { headers }).then(async r => {
      if (r.ok) {
        const blob = await r.blob();
        updateFavicon(URL.createObjectURL(blob));
      }
    }).catch(() => {});
    // Listen for branding updates from Settings page
    function onBrandingUpdate(e) {
      const { logo, favicon } = e.detail || {};
      if (logo === null) setSidebarLogo('/favicon.svg');
      else if (logo) setSidebarLogo(logo);
      if (favicon === null) updateFavicon('/favicon.svg');
      else if (favicon) updateFavicon(favicon);
    }
    window.addEventListener('branding-updated', onBrandingUpdate);
    return () => window.removeEventListener('branding-updated', onBrandingUpdate);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  // Module code required for each nav item (null = always visible)
  const navSections = [
    {
      label: 'Main',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/activity-log', icon: Activity, label: 'Activity Log' },
        { to: '/notices', icon: Megaphone, label: 'Notices', module: 'notice' },
        { to: '/policies', icon: FileText, label: 'Policies' },
      ],
    },
    {
      label: 'My Space',
      items: [
        { to: '/attendance', icon: Clock, label: 'My Attendance', module: 'attendance' },
        { to: '/leaves', icon: CalendarDays, label: 'My Leaves', module: 'leave' },
        { to: '/leave-calendar', icon: CalendarRange, label: 'Monthly Calendar', module: 'leave' },
        { to: '/profile', icon: UserCircle, label: 'My Profile' },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Team',
            items: [
              { to: '/employees', icon: Users, label: 'Employees' },
              { to: '/employee-attendance', icon: ClipboardList, label: 'Employee Attendance', module: 'attendance' },
              { to: '/leave-management', icon: ClipboardCheck, label: 'Leave Requests', module: 'leave' },
            ],
          },
          {
            label: 'Organization',
            items: [
              { to: '/branches', icon: MapPin, label: 'Branches' },
              { to: '/roles', icon: Shield, label: 'Roles' },
              { to: '/shifts', icon: Clock, label: 'Shifts' },
              { to: '/schedules', icon: CalendarRange, label: 'Work Schedules' },
              { to: '/assignments', icon: Users, label: 'Assignments' },
            ],
          },
          {
            label: 'Reports',
            items: [
              { to: '/reports', icon: BarChart3, label: 'Reports', module: 'report' },
              { to: '/payroll', icon: DollarSign, label: 'Payroll & Overtime', module: 'payroll' },
            ],
          },
          {
            label: 'Configuration',
            items: [
              { to: '/settings', icon: Settings, label: 'General Settings' },
              { to: '/holidays', icon: Star, label: 'Holidays', module: 'holiday' },
              { to: '/geofence', icon: Navigation, label: 'Geofence', module: 'geofence' },
              { to: '/nfc', icon: CreditCard, label: 'NFC Management', module: 'device' },
              { to: '/devices', icon: Smartphone, label: 'Devices', module: 'device' },
            ],
          },
        ]
      : []),
  ];

  // Filter nav items by enabled modules
  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (!item.module) return true; // No module restriction
      if (!enabledModules) return true; // Still loading, show all
      return enabledModules.includes(item.module);
    }),
  })).filter(section => section.items.length > 0);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <img src={sidebarLogo} alt="Logo" className="h-12 max-w-[250px] object-contain" />
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {filteredNavSections.map((section, idx) => (
            <div key={section.label}>
              {idx > 0 && <div className="border-t border-slate-100 mb-3" />}
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
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
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          <div className="flex items-center gap-3">
            <NotificationBell />
            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                  {user?.name?.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900 leading-tight">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 leading-tight capitalize">{user?.role === 'admin' ? 'Administrator' : user?.designation || user?.role}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <UserCircle size={16} /> My Profile
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Settings size={16} /> Settings
                      </button>
                    )}
                    <button
                      onClick={() => { navigate('/policies'); setProfileOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <FileText size={16} /> Policies
                    </button>
                    <button
                      onClick={() => { navigate('/leaves'); setProfileOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <CalendarDays size={16} /> My Leaves
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
