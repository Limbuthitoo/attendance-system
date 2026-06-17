import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { api } from '../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [account, setAccount] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function verify() {
      setLoading(true);
      setError('');
      try {
        const result = await api.verifyResetToken(token);
        if (mounted) setAccount(result);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!token) {
      setError('Reset token is missing.');
      setLoading(false);
    } else {
      verify();
    }

    return () => { mounted = false; };
  }, [token]);

  function validatePassword() {
    const failures = [];
    if (newPassword.length < 8) failures.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) failures.push('one uppercase letter');
    if (!/[a-z]/.test(newPassword)) failures.push('one lowercase letter');
    if (!/[0-9]/.test(newPassword)) failures.push('one digit');
    if (!/[^A-Za-z0-9]/.test(newPassword)) failures.push('one special character');
    if (failures.length > 0) return `Password must contain: ${failures.join(', ')}`;
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api.confirmResetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
            {done ? <CheckCircle2 size={24} className="text-green-600" /> : <Lock size={24} className="text-primary-600" />}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Set New Password</h1>
          {account && <p className="text-sm text-slate-500 mt-1">{account.email} - {account.orgName}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {loading && <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" /></div>}
          {!loading && done && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">Password updated. Redirecting to sign in...</div>}
          {!loading && error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}

          {!loading && account && !done && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
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
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : 'Update Password'}
              </button>
            </>
          )}
        </form>

        <Link to="/login" className="block text-center mt-4 text-sm text-slate-500 hover:text-primary-600 transition">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
