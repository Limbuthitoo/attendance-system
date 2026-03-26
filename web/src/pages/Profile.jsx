import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Eye, EyeOff, KeyRound, User, Mail, Building, Briefcase, Phone } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">My Profile</h2>
        <p className="text-sm text-slate-500 mt-1">View your details and change password</p>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold">
            {user?.name?.charAt(0)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{user?.name}</h3>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 capitalize">{user?.role}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: User, label: 'Employee ID', value: user?.employee_id },
            { icon: Mail, label: 'Email', value: user?.email },
            { icon: Building, label: 'Department', value: user?.department },
            { icon: Briefcase, label: 'Designation', value: user?.designation },
            { icon: Phone, label: 'Phone', value: user?.phone || '—' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <item.icon size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-700">Change Password</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>
          )}
          {success && (
            <div className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-4 py-2.5">{success}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
