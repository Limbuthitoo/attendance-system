import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Employees from './pages/Employees';
import LeaveManagement from './pages/LeaveManagement';
import LeaveCalendar from './pages/LeaveCalendar';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';
import HolidayManager from './pages/HolidayManager';
import AppUpdate from './pages/AppUpdate';
import Notices from './pages/Notices';
import EmployeeProfile from './pages/EmployeeProfile';
import EmployeeAttendance from './pages/EmployeeAttendance';
import Profile from './pages/Profile';
import BranchManagement from './pages/BranchManagement';
import RoleManagement from './pages/RoleManagement';
import ShiftManagement from './pages/ShiftManagement';
import ScheduleManagement from './pages/ScheduleManagement';
import EmployeeAssignments from './pages/EmployeeAssignments';
import DeviceManagement from './pages/DeviceManagement';
import Reports from './pages/Reports';
import PayrollOvertime from './pages/PayrollOvertime';
import GeofenceManagement from './pages/GeofenceManagement';
import { Lock, Eye, EyeOff, LogOut } from 'lucide-react';

// Platform portal imports
import { PlatformAuthProvider, usePlatformAuth } from './platform/PlatformAuthContext';
import PlatformLayout from './platform/PlatformLayout';
import PlatformLogin from './platform/pages/PlatformLogin';
import PlatformDashboard from './platform/pages/PlatformDashboard';
import Organizations from './platform/pages/Organizations';
import OrganizationDetail from './platform/pages/OrganizationDetail';
import CreateOrganization from './platform/pages/CreateOrganization';
import PlatformModules from './platform/pages/PlatformModules';
import Plans from './platform/pages/Plans';
import Billing from './platform/pages/Billing';
import PlatformUsers from './platform/pages/PlatformUsers';

function ForcePasswordChange() {
  const { user, setUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const failures = [];
    if (newPassword.length < 8) failures.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) failures.push('one uppercase letter');
    if (!/[a-z]/.test(newPassword)) failures.push('one lowercase letter');
    if (!/[0-9]/.test(newPassword)) failures.push('one digit');
    if (!/[^A-Za-z0-9]/.test(newPassword)) failures.push('one special character (!@#$%^&*)');
    if (failures.length > 0) {
      setError(`Password must contain: ${failures.join(', ')}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setUser({ ...user, must_change_password: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={24} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Change Your Password</h2>
          <p className="text-sm text-slate-500 mt-1">You must set a new password before continuing</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10"
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              'Update Password'
            )}
          </button>
        </form>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 mx-auto mt-4 text-sm text-slate-500 hover:text-red-600 transition"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <ForcePasswordChange />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function PlatformProtectedRoute({ children }) {
  const { user, loading } = usePlatformAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/platform/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Platform portal routes */}
      <Route path="/platform/login" element={
        <PlatformAuthProvider><PlatformLogin /></PlatformAuthProvider>
      } />
      <Route path="/platform" element={
        <PlatformAuthProvider>
          <PlatformProtectedRoute>
            <PlatformLayout />
          </PlatformProtectedRoute>
        </PlatformAuthProvider>
      }>
        <Route index element={<PlatformDashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="organizations/new" element={<CreateOrganization />} />
        <Route path="organizations/:id" element={<OrganizationDetail />} />
        <Route path="modules" element={<PlatformModules />} />
        <Route path="plans" element={<Plans />} />
        <Route path="billing" element={<Billing />} />
        <Route path="users" element={<PlatformUsers />} />
      </Route>

      {/* Org-level routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="leave-management" element={<AdminRoute><LeaveManagement /></AdminRoute>} />
        <Route path="leave-calendar" element={<LeaveCalendar />} />
        <Route path="notices" element={<Notices />} />
        <Route path="employees" element={<AdminRoute><Employees /></AdminRoute>} />
        <Route path="employees/:id" element={<AdminRoute><EmployeeProfile /></AdminRoute>} />
        <Route path="employee-attendance" element={<AdminRoute><EmployeeAttendance /></AdminRoute>} />
        <Route path="activity-log" element={<ActivityLog />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="holidays" element={<AdminRoute><HolidayManager /></AdminRoute>} />
        <Route path="app-update" element={<AdminRoute><AppUpdate /></AdminRoute>} />
        <Route path="branches" element={<AdminRoute><BranchManagement /></AdminRoute>} />
        <Route path="roles" element={<AdminRoute><RoleManagement /></AdminRoute>} />
        <Route path="shifts" element={<AdminRoute><ShiftManagement /></AdminRoute>} />
        <Route path="schedules" element={<AdminRoute><ScheduleManagement /></AdminRoute>} />
        <Route path="assignments" element={<AdminRoute><EmployeeAssignments /></AdminRoute>} />
        <Route path="devices" element={<AdminRoute><DeviceManagement /></AdminRoute>} />
        <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="payroll" element={<AdminRoute><PayrollOvertime /></AdminRoute>} />
        <Route path="geofence" element={<AdminRoute><GeofenceManagement /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
