import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import { Lock, Eye, EyeOff, LogOut } from 'lucide-react';

// ── Lazy-loaded org pages (each becomes its own chunk) ──────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Leaves = lazy(() => import('./pages/Leaves'));
const Employees = lazy(() => import('./pages/Employees'));
const LeaveManagement = lazy(() => import('./pages/LeaveManagement'));
const LeaveCalendar = lazy(() => import('./pages/LeaveCalendar'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const Settings = lazy(() => import('./pages/Settings'));
const HolidayManager = lazy(() => import('./pages/HolidayManager'));
const Notices = lazy(() => import('./pages/Notices'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const EmployeeAttendance = lazy(() => import('./pages/EmployeeAttendance'));
const Profile = lazy(() => import('./pages/Profile'));
const BranchManagement = lazy(() => import('./pages/BranchManagement'));
const RoleManagement = lazy(() => import('./pages/RoleManagement'));
const ShiftManagement = lazy(() => import('./pages/ShiftManagement'));
const ScheduleManagement = lazy(() => import('./pages/ScheduleManagement'));
const EmployeeAssignments = lazy(() => import('./pages/EmployeeAssignments'));
const Reports = lazy(() => import('./pages/Reports'));
const PayrollOvertime = lazy(() => import('./pages/PayrollOvertime'));
const GeofenceManagement = lazy(() => import('./pages/GeofenceManagement'));
const NfcManagement = lazy(() => import('./pages/NfcManagement'));
const DeviceManagement = lazy(() => import('./pages/DeviceManagement'));
const Policies = lazy(() => import('./pages/Policies'));
const Incentives = lazy(() => import('./pages/Incentives'));
const CRM = lazy(() => import('./pages/CRM'));
const Performance = lazy(() => import('./pages/Performance'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Projects = lazy(() => import('./pages/Projects'));
const Referrals = lazy(() => import('./pages/Referrals'));
const Bonuses = lazy(() => import('./pages/Bonuses'));
const Accounting = lazy(() => import('./pages/Accounting'));
const OrgBilling = lazy(() => import('./pages/Billing'));
const StatutoryCompliance = lazy(() => import('./pages/StatutoryCompliance'));
const Recruitment = lazy(() => import('./pages/Recruitment'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Separation = lazy(() => import('./pages/Separation'));
const Training = lazy(() => import('./pages/Training'));
const SelfService = lazy(() => import('./pages/SelfService'));
const CompensationPage = lazy(() => import('./pages/Compensation'));
const OrgChart = lazy(() => import('./pages/OrgChart'));

// ── Lazy-loaded platform portal (entire sub-app) ───────────────────────────
const PlatformLogin = lazy(() => import('./platform/pages/PlatformLogin'));
const PlatformDashboard = lazy(() => import('./platform/pages/PlatformDashboard'));
const Organizations = lazy(() => import('./platform/pages/Organizations'));
const OrganizationDetail = lazy(() => import('./platform/pages/OrganizationDetail'));
const CreateOrganization = lazy(() => import('./platform/pages/CreateOrganization'));
const PlatformModules = lazy(() => import('./platform/pages/PlatformModules'));
const Plans = lazy(() => import('./platform/pages/Plans'));
const Billing = lazy(() => import('./platform/pages/Billing'));
const PlatformUsers = lazy(() => import('./platform/pages/PlatformUsers'));
const AppUpdateManager = lazy(() => import('./platform/pages/AppUpdateManager'));
const PlatformDevices = lazy(() => import('./platform/pages/PlatformDevices'));
const DeviceCatalog = lazy(() => import('./platform/pages/DeviceCatalog'));
const PlatformSettings = lazy(() => import('./platform/pages/PlatformSettings'));

// Platform auth — eagerly loaded (small, needed for route guards)
import { PlatformAuthProvider, usePlatformAuth } from './platform/PlatformAuthContext';
import PlatformLayout from './platform/PlatformLayout';

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  );
}

function LazyPage({ name, children }) {
  return (
    <ErrorBoundary name={name}>
      <Suspense fallback={<PageSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

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
        <PlatformAuthProvider>
          <LazyPage name="Platform Login"><PlatformLogin /></LazyPage>
        </PlatformAuthProvider>
      } />
      <Route path="/platform" element={
        <PlatformAuthProvider>
          <PlatformProtectedRoute>
            <PlatformLayout />
          </PlatformProtectedRoute>
        </PlatformAuthProvider>
      }>
        <Route index element={<LazyPage name="Platform Dashboard"><PlatformDashboard /></LazyPage>} />
        <Route path="organizations" element={<LazyPage name="Organizations"><Organizations /></LazyPage>} />
        <Route path="organizations/new" element={<LazyPage name="Create Organization"><CreateOrganization /></LazyPage>} />
        <Route path="organizations/:id" element={<LazyPage name="Organization Detail"><OrganizationDetail /></LazyPage>} />
        <Route path="modules" element={<LazyPage name="Modules"><PlatformModules /></LazyPage>} />
        <Route path="plans" element={<LazyPage name="Plans"><Plans /></LazyPage>} />
        <Route path="billing" element={<LazyPage name="Billing"><Billing /></LazyPage>} />
        <Route path="users" element={<LazyPage name="Users"><PlatformUsers /></LazyPage>} />
        <Route path="app-update" element={<LazyPage name="App Update"><AppUpdateManager /></LazyPage>} />
        <Route path="devices" element={<LazyPage name="Devices"><PlatformDevices /></LazyPage>} />
        <Route path="device-catalog" element={<LazyPage name="Device Catalog"><DeviceCatalog /></LazyPage>} />
        <Route path="settings" element={<LazyPage name="Settings"><PlatformSettings /></LazyPage>} />
      </Route>

      {/* Org-level routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<LazyPage name="Dashboard"><Dashboard /></LazyPage>} />
        <Route path="attendance" element={<LazyPage name="Attendance"><Attendance /></LazyPage>} />
        <Route path="leaves" element={<LazyPage name="Leaves"><Leaves /></LazyPage>} />
        <Route path="leave-management" element={<AdminRoute><LazyPage name="Leave Management"><LeaveManagement /></LazyPage></AdminRoute>} />
        <Route path="leave-calendar" element={<LazyPage name="Leave Calendar"><LeaveCalendar /></LazyPage>} />
        <Route path="notices" element={<LazyPage name="Notices"><Notices /></LazyPage>} />
        <Route path="employees" element={<AdminRoute><LazyPage name="Employees"><Employees /></LazyPage></AdminRoute>} />
        <Route path="employees/:id" element={<AdminRoute><LazyPage name="Employee Profile"><EmployeeProfile /></LazyPage></AdminRoute>} />
        <Route path="employee-attendance" element={<AdminRoute><LazyPage name="Employee Attendance"><EmployeeAttendance /></LazyPage></AdminRoute>} />
        <Route path="activity-log" element={<LazyPage name="Activity Log"><ActivityLog /></LazyPage>} />
        <Route path="profile" element={<LazyPage name="Profile"><Profile /></LazyPage>} />
        <Route path="settings" element={<AdminRoute><LazyPage name="Settings"><Settings /></LazyPage></AdminRoute>} />
        <Route path="holidays" element={<AdminRoute><LazyPage name="Holidays"><HolidayManager /></LazyPage></AdminRoute>} />
        <Route path="branches" element={<AdminRoute><LazyPage name="Branches"><BranchManagement /></LazyPage></AdminRoute>} />
        <Route path="roles" element={<AdminRoute><LazyPage name="Roles"><RoleManagement /></LazyPage></AdminRoute>} />
        <Route path="shifts" element={<AdminRoute><LazyPage name="Shifts"><ShiftManagement /></LazyPage></AdminRoute>} />
        <Route path="schedules" element={<AdminRoute><LazyPage name="Schedules"><ScheduleManagement /></LazyPage></AdminRoute>} />
        <Route path="assignments" element={<AdminRoute><LazyPage name="Assignments"><EmployeeAssignments /></LazyPage></AdminRoute>} />
        <Route path="reports" element={<AdminRoute><LazyPage name="Reports"><Reports /></LazyPage></AdminRoute>} />
        <Route path="payroll" element={<AdminRoute><LazyPage name="Payroll"><PayrollOvertime /></LazyPage></AdminRoute>} />
        <Route path="incentives" element={<AdminRoute><LazyPage name="Incentives"><Incentives /></LazyPage></AdminRoute>} />
        <Route path="crm" element={<AdminRoute><LazyPage name="CRM"><CRM /></LazyPage></AdminRoute>} />
        <Route path="performance" element={<AdminRoute><LazyPage name="Performance"><Performance /></LazyPage></AdminRoute>} />
        <Route path="tasks" element={<AdminRoute><LazyPage name="Tasks"><Tasks /></LazyPage></AdminRoute>} />
        <Route path="projects" element={<AdminRoute><LazyPage name="Projects"><Projects /></LazyPage></AdminRoute>} />
        <Route path="referrals" element={<AdminRoute><LazyPage name="Referrals"><Referrals /></LazyPage></AdminRoute>} />
        <Route path="bonuses" element={<AdminRoute><LazyPage name="Bonuses"><Bonuses /></LazyPage></AdminRoute>} />
        <Route path="accounting" element={<AdminRoute><LazyPage name="Accounting"><Accounting /></LazyPage></AdminRoute>} />
        <Route path="billing" element={<AdminRoute><LazyPage name="Billing"><OrgBilling /></LazyPage></AdminRoute>} />
        <Route path="statutory" element={<AdminRoute><LazyPage name="Statutory Compliance"><StatutoryCompliance /></LazyPage></AdminRoute>} />
        <Route path="recruitment" element={<AdminRoute><LazyPage name="Recruitment"><Recruitment /></LazyPage></AdminRoute>} />
        <Route path="onboarding" element={<AdminRoute><LazyPage name="Onboarding"><Onboarding /></LazyPage></AdminRoute>} />
        <Route path="separation" element={<AdminRoute><LazyPage name="Separation"><Separation /></LazyPage></AdminRoute>} />
        <Route path="training" element={<AdminRoute><LazyPage name="Training"><Training /></LazyPage></AdminRoute>} />
        <Route path="self-service" element={<LazyPage name="Self Service"><SelfService /></LazyPage>} />
        <Route path="compensation" element={<AdminRoute><LazyPage name="Compensation"><CompensationPage /></LazyPage></AdminRoute>} />
        <Route path="org-chart" element={<LazyPage name="Org Chart"><OrgChart /></LazyPage>} />
        <Route path="geofence" element={<AdminRoute><LazyPage name="Geofence"><GeofenceManagement /></LazyPage></AdminRoute>} />
        <Route path="nfc" element={<AdminRoute><LazyPage name="NFC Management"><NfcManagement /></LazyPage></AdminRoute>} />
        <Route path="devices" element={<AdminRoute><LazyPage name="Devices"><DeviceManagement /></LazyPage></AdminRoute>} />
        <Route path="policies" element={<LazyPage name="Policies"><Policies /></LazyPage>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
